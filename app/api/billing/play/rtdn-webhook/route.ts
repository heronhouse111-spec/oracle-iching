/**
 * POST /api/billing/play/rtdn-webhook
 *
 * Google Play Real-time Developer Notifications (RTDN) push 接收端。
 *
 * 用來接收 Play Store 推送的訂閱事件:續期 / 取消 / 退款 / 暫停 / 過期 等。
 * 不接這個的話,訂閱戶在 Play 端取消後,我們的 DB 會一直顯示為「active」直到 expires_at,
 * 但實際使用者可能已經換 device、退款、被 Google 撤銷等。
 *
 * 部署前置作業(使用者要做):
 *   1. GCP Console 建立 Pub/Sub topic (e.g. play-rtdn)
 *   2. 為這個 topic 建 push subscription
 *      - Push endpoint: https://oracle.heronhouse.me/api/billing/play/rtdn-webhook?secret=<RTDN_SHARED_SECRET>
 *      - 不啟用 OIDC(目前用 query string secret 認證,簡單)
 *   3. Play Console → Monetize → Subscriptions → 設定 RTDN
 *      - Topic name: projects/<project-id>/topics/play-rtdn
 *      - 確認 google-play-developer-notifications@system.gserviceaccount.com
 *        在 GCP topic 的 Pub/Sub Publisher 角色
 *   4. Vercel 設 RTDN_SHARED_SECRET (隨機 64 字元 hex)
 *
 * 訊息格式(Pub/Sub push):
 *   {
 *     "message": {
 *       "data": "<base64-encoded JSON>",
 *       "messageId": "...",
 *       "publishTime": "..."
 *     },
 *     "subscription": "projects/.../subscriptions/..."
 *   }
 *
 * data 解碼後:
 *   {
 *     "version": "1.0",
 *     "packageName": "me.heronhouse.oracle",
 *     "eventTimeMillis": "1234567890000",
 *     "subscriptionNotification": {
 *       "version": "1.0",
 *       "notificationType": 4,
 *       "purchaseToken": "...",
 *       "subscriptionId": "orc.subscription.monthly"
 *     }
 *   }
 *
 * notificationType:
 *   1  SUBSCRIPTION_RECOVERED   - 從 hold 恢復(自動續扣成功)
 *   2  SUBSCRIPTION_RENEWED     - 自動續扣成功
 *   3  SUBSCRIPTION_CANCELED    - 使用者取消(但仍有效到 expiry)
 *   4  SUBSCRIPTION_PURCHASED   - 首次訂閱(client 端 verify-purchase 已處理過,這裡 idempotent)
 *   5  SUBSCRIPTION_ON_HOLD     - 帳單失敗,30 天寬限
 *   6  SUBSCRIPTION_IN_GRACE_PERIOD - 帳單失敗,3 天寬限
 *   7  SUBSCRIPTION_RESTARTED   - 取消後恢復訂閱
 *   12 SUBSCRIPTION_REVOKED     - 退款 / 詐欺撤銷,立即停權
 *   13 SUBSCRIPTION_EXPIRED     - 訂閱自然過期
 *
 * 我們處理:2/3/4/12/13(其他先 log,有需要再補)
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PLAY_PACKAGE_NAME,
  SKU_TO_SUBSCRIPTION_PLAN,
  isSubscriptionSku,
} from "@/lib/billing/playSkus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Notification types (Google 文件)
const NotificationType = {
  RECOVERED: 1,
  RENEWED: 2,
  CANCELED: 3,
  PURCHASED: 4,
  ON_HOLD: 5,
  IN_GRACE_PERIOD: 6,
  RESTARTED: 7,
  PRICE_CHANGE_CONFIRMED: 8,
  DEFERRED: 9,
  PAUSED: 10,
  PAUSE_SCHEDULE_CHANGED: 11,
  REVOKED: 12,
  EXPIRED: 13,
} as const;

interface PubSubPushBody {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface RtdnPayload {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  // 也可能有 oneTimeProductNotification / testNotification,目前不處理
  testNotification?: {
    version?: string;
  };
  oneTimeProductNotification?: unknown;
}

export async function POST(req: NextRequest) {
  // -------- 1. 認證(query string secret)--------
  const url = new URL(req.url);
  const secretFromUrl = url.searchParams.get("secret") ?? "";
  const expected = process.env.RTDN_SHARED_SECRET;
  if (!expected) {
    console.error("[rtdn] 缺 RTDN_SHARED_SECRET");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (secretFromUrl !== expected) {
    console.warn("[rtdn] secret mismatch", {
      from: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // -------- 2. Parse Pub/Sub push body --------
  let body: PubSubPushBody;
  try {
    body = (await req.json()) as PubSubPushBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.message?.data) {
    return NextResponse.json(
      { error: "no_message_data" },
      { status: 400 },
    );
  }

  // -------- 3. 解 base64 → JSON --------
  let rtdn: RtdnPayload;
  try {
    const raw = Buffer.from(body.message.data, "base64").toString("utf8");
    rtdn = JSON.parse(raw) as RtdnPayload;
  } catch (e) {
    console.error("[rtdn] base64/JSON decode failed", e);
    // 還是 ack(回 200),不然 Pub/Sub 會一直 retry
    return NextResponse.json({ ok: true, ignored: "decode_failed" });
  }

  // -------- 4. testNotification:Play Console 設定時會送一次測試 --------
  if (rtdn.testNotification) {
    console.log("[rtdn] received testNotification, ack", {
      messageId: body.message.messageId,
    });
    return NextResponse.json({ ok: true, type: "test" });
  }

  // -------- 5. 只處理訂閱類別,其他 ack 後 noop --------
  if (!rtdn.subscriptionNotification) {
    console.log("[rtdn] non-subscription event, skip", {
      messageId: body.message.messageId,
      keys: Object.keys(rtdn),
    });
    return NextResponse.json({ ok: true, ignored: "non_subscription" });
  }

  const sub = rtdn.subscriptionNotification;
  const sku = sub.subscriptionId ?? "";
  const purchaseToken = sub.purchaseToken ?? "";
  const notType = sub.notificationType ?? -1;

  if (!sku || !purchaseToken) {
    return NextResponse.json(
      { error: "missing_sub_fields" },
      { status: 400 },
    );
  }

  if (!isSubscriptionSku(sku)) {
    console.warn("[rtdn] unknown subscription sku, skip", { sku });
    return NextResponse.json({ ok: true, ignored: "unknown_sku" });
  }

  // -------- 6. 找出對應 user(透過 play_purchases.purchase_token)--------
  const admin = createAdminClient();

  const { data: existingPurchase } = await admin
    .from("play_purchases")
    .select("id, user_id, status, sku")
    .eq("purchase_token", purchaseToken)
    .maybeSingle();

  // PURCHASED:首次訂閱可能在 client verify-purchase 之前就到(不太可能但要防),
  // 或者 client 還沒驗就丟事件 → 沒 user_id 就無法處理,等 client verify 補上
  if (!existingPurchase) {
    console.log("[rtdn] purchase not yet recorded, skip until client verifies", {
      purchaseToken: purchaseToken.slice(0, 12) + "...",
      type: notType,
    });
    // ack:Pub/Sub 預設 10 秒就會重送一次,我們 ack 後等 client 那邊跑完 verify-purchase
    // 之後 RTDN 還會持續推續期 / 取消等事件,屆時 user_id 已經寫進去了
    return NextResponse.json({ ok: true, ignored: "purchase_not_found" });
  }

  const userId = existingPurchase.user_id;
  const planId = SKU_TO_SUBSCRIPTION_PLAN[sku];

  // -------- 7. 依 notification type 分流 --------
  switch (notType) {
    case NotificationType.PURCHASED:
    case NotificationType.RENEWED:
    case NotificationType.RECOVERED:
    case NotificationType.RESTARTED: {
      // 三種都是「現在訂閱有效」,跟 Google 拉最新 expiry 然後寫進 profile
      await refreshSubscriptionFromGoogle(admin, {
        userId,
        sku,
        purchaseToken,
        planId,
      });
      break;
    }

    case NotificationType.CANCELED: {
      // 使用者取消,但訂閱仍有效到 expiry。
      // 標記 status=canceled,但不改 expires_at,讓 has_active_subscription() 在期限內仍回 true。
      await admin
        .from("profiles")
        .update({ subscription_status: "canceled" })
        .eq("id", userId);

      await admin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("provider_subscription_id", purchaseToken);
      break;
    }

    case NotificationType.EXPIRED: {
      // 訂閱自然到期,降回免費
      await admin
        .from("profiles")
        .update({
          subscription_status: "expired",
          subscription_plan: null,
          // 留 expires_at 當歷史紀錄
        })
        .eq("id", userId);

      await admin
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("provider_subscription_id", purchaseToken);
      break;
    }

    case NotificationType.REVOKED: {
      // 退款 / 詐欺撤銷,立即停權
      await admin
        .from("profiles")
        .update({
          subscription_status: "expired",
          subscription_plan: null,
          subscription_expires_at: new Date().toISOString(),
        })
        .eq("id", userId);

      await admin
        .from("subscriptions")
        .update({ status: "refunded" })
        .eq("provider_subscription_id", purchaseToken);

      await admin
        .from("play_purchases")
        .update({ status: "revoked", status_reason: "RTDN type=12 (revoked)" })
        .eq("purchase_token", purchaseToken);
      break;
    }

    case NotificationType.ON_HOLD:
    case NotificationType.IN_GRACE_PERIOD: {
      // 帳單失敗中。此時訂閱還是有效,但要提醒使用者更新付款方式。
      // 我們暫時只 log,不改狀態(避免使用者一筆失敗就被降權)。
      console.log("[rtdn] subscription billing issue", {
        userId,
        type: notType,
        sku,
      });
      break;
    }

    case NotificationType.PAUSED:
    case NotificationType.PAUSE_SCHEDULE_CHANGED:
    case NotificationType.DEFERRED:
    case NotificationType.PRICE_CHANGE_CONFIRMED: {
      // 不影響有效性的事件,log 就好
      console.log("[rtdn] non-critical sub event", {
        userId,
        type: notType,
        sku,
      });
      break;
    }

    default: {
      console.warn("[rtdn] unknown notificationType", {
        type: notType,
        sku,
      });
    }
  }

  // -------- 8. 一律回 200 ack --------
  // 任何 4xx/5xx 都會被 Pub/Sub 重送,造成處理 storm
  return NextResponse.json({
    ok: true,
    type: notType,
    sku,
  });
}

// ---------- helper: 跟 Google 拉最新訂閱資料,寫進 profiles ----------
async function refreshSubscriptionFromGoogle(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    userId: string;
    sku: string;
    purchaseToken: string;
    planId: "monthly" | "yearly";
  },
): Promise<void> {
  const credsRaw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!credsRaw) {
    console.error("[rtdn] 缺 GCP_SERVICE_ACCOUNT_JSON,無法跟 Google 驗");
    return;
  }
  let credentials;
  try {
    credentials = JSON.parse(credsRaw);
  } catch (e) {
    console.error("[rtdn] GCP_SERVICE_ACCOUNT_JSON not valid JSON", e);
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const publisher = google.androidpublisher({ version: "v3", auth });

  let subInfo;
  try {
    const res = await publisher.purchases.subscriptions.get({
      packageName: PLAY_PACKAGE_NAME,
      subscriptionId: args.sku,
      token: args.purchaseToken,
    });
    subInfo = res.data;
  } catch (e) {
    console.error("[rtdn] subscriptions.get failed", e);
    return;
  }

  const expiryMillis = Number(subInfo.expiryTimeMillis ?? 0);
  if (expiryMillis === 0) {
    console.warn("[rtdn] subscription has no expiry, skip", {
      userId: args.userId,
    });
    return;
  }
  const expiresAt = new Date(expiryMillis).toISOString();
  const startedAt = subInfo.startTimeMillis
    ? new Date(Number(subInfo.startTimeMillis)).toISOString()
    : new Date().toISOString();

  // 更新 profiles
  await admin
    .from("profiles")
    .update({
      subscription_status: "active",
      subscription_plan: args.planId,
      subscription_started_at: startedAt,
      subscription_expires_at: expiresAt,
    })
    .eq("id", args.userId);

  // 寫一筆 subscriptions 歷程(每次續期都記)
  // idempotency:用 purchase_token + expiresAt 組合判斷
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider", "google_play")
    .eq("provider_subscription_id", args.purchaseToken)
    .eq("expires_at", expiresAt)
    .maybeSingle();

  if (!existingSub) {
    await admin.from("subscriptions").insert({
      user_id: args.userId,
      plan: args.planId,
      status: "active",
      provider: "google_play",
      provider_txn_id: subInfo.orderId ?? null,
      provider_subscription_id: args.purchaseToken,
      amount: 0,
      currency: subInfo.priceCurrencyCode ?? "TWD",
      started_at: startedAt,
      expires_at: expiresAt,
      raw_payload: subInfo as never,
    });
  }
}
