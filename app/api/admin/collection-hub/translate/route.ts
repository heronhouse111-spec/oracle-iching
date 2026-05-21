/**
 * POST /api/admin/collection-hub/translate?id=xxx&mode=missing-only|all
 *
 * 從 row 的 title_zh / body_zh 用 DeepSeek 翻譯,填回 title_xx / body_xx 欄位。
 * mode:
 *   - missing-only(預設):只翻譯目前是 NULL 的語系,已有翻譯保留
 *   - all:覆寫全部 en/ja/ko(慎用)
 *
 * 平行翻譯 3 語系(en/ja/ko),失敗的語系跳過,其他成功的仍會寫入。
 *
 * Response:
 *   200 { ok: true, translated: ['en','ja'], skipped: ['ko'], errors: [...] }
 *   400/404/500
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateShort, type TargetLang } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 三語平行翻譯 ≈ 5-15 秒

interface RowSnapshot {
  id: string;
  title_zh: string | null;
  title_en: string | null;
  title_ja: string | null;
  title_ko: string | null;
  body_zh: string | null;
  body_en: string | null;
  body_ja: string | null;
  body_ko: string | null;
}

function langsNeeded(row: RowSnapshot, mode: "missing-only" | "all"): TargetLang[] {
  if (mode === "all") return ["en", "ja", "ko"];
  const out: TargetLang[] = [];
  // 該語系該欄位為 null 才需要翻 — title 跟 body 同一個 row 一起翻,
  // 任一缺就翻整 row(然後選擇性套到缺的那欄)
  const needsLang = (lang: TargetLang) => {
    const titleHasZh = !!row.title_zh;
    const bodyHasZh = !!row.body_zh;
    const titleNull = titleHasZh && row[`title_${lang}`] == null;
    const bodyNull = bodyHasZh && row[`body_${lang}`] == null;
    return titleNull || bodyNull;
  };
  if (needsLang("en")) out.push("en");
  if (needsLang("ja")) out.push("ja");
  if (needsLang("ko")) out.push("ko");
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const mode = url.searchParams.get("mode") === "all" ? "all" : "missing-only";

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: row, error: readErr } = await supabase
    .from("collection_hub_content")
    .select("id, title_zh, title_en, title_ja, title_ko, body_zh, body_en, body_ja, body_ko")
    .eq("id", id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: "db_error", detail: readErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const snapshot = row as RowSnapshot;
  const hasZh = !!snapshot.title_zh || !!snapshot.body_zh;
  if (!hasZh) {
    return NextResponse.json(
      { error: "no_source", detail: "title_zh and body_zh are both empty — fill zh first" },
      { status: 400 },
    );
  }

  const langs = langsNeeded(snapshot, mode);
  if (langs.length === 0) {
    return NextResponse.json({ ok: true, translated: [], skipped: ["en", "ja", "ko"], errors: [] });
  }

  // 平行翻
  const settled = await Promise.allSettled(
    langs.map((lang) =>
      translateShort({ title: snapshot.title_zh, body: snapshot.body_zh }, lang).then((res) => ({
        lang,
        res,
      })),
    ),
  );

  const patch: Record<string, unknown> = {};
  const translated: TargetLang[] = [];
  const errors: { lang: TargetLang; message: string }[] = [];

  for (const r of settled) {
    if (r.status === "fulfilled") {
      const { lang, res } = r.value;
      // 模式為 all 才覆寫已有的;missing-only 只填 null 欄位
      const titleKey = `title_${lang}` as const;
      const bodyKey = `body_${lang}` as const;
      const writeTitle = mode === "all" ? !!snapshot.title_zh : snapshot[titleKey] == null && !!snapshot.title_zh;
      const writeBody = mode === "all" ? !!snapshot.body_zh : snapshot[bodyKey] == null && !!snapshot.body_zh;
      if (writeTitle && res.title != null) patch[titleKey] = res.title;
      if (writeBody && res.body != null) patch[bodyKey] = res.body;
      translated.push(lang);
    } else {
      errors.push({
        lang: "en", // 不知道哪個 lang 失敗（順序依 langs)
        message: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, translated, skipped: [], errors, note: "nothing to write" });
  }

  const { error: writeErr } = await supabase
    .from("collection_hub_content")
    .update(patch)
    .eq("id", id);

  if (writeErr) {
    return NextResponse.json({ error: "db_error", detail: writeErr.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "collection_hub_content.translate",
    targetType: "collection_hub_content",
    targetId: id,
    payload: { mode, translated, errors: errors.length > 0 ? errors : undefined },
  });

  return NextResponse.json({ ok: true, translated, errors });
}
