/**
 * 音樂內容審核 — Phase 27
 *
 * 兩層防線:
 *   Layer 1:built-in 黑名單(必過,不依賴外部服務)
 *           政治敏感詞、品牌名、知名藝人、明顯不雅詞
 *   Layer 2:OpenAI Moderation API(若 OPENAI_API_KEY 設定才呼叫,FREE)
 *           hate / sexual / violence / harassment / self-harm
 *
 * 任一層 block → 整體 reject。回傳 { allowed, reason, layer }。
 *
 * 觸發點:
 *   - /api/music/generate:扣點前先過,擋下來不扣錢、不打 Stable Audio
 *   - /api/music/publish:public 上架前再過一次(縱深防守)
 *
 * 設計取捨:
 *   - 不做語意分析(如「在 X 風格」=> 抄襲),太多誤判;靠用戶檢舉 + 累計觸發後台介入
 *   - 黑名單故意保守(不收太多詞),避免擋掉合法描述
 */

// ──────────────────────────────────────────
// 1. Built-in 黑名單 — 任何語言出現直接擋
// ──────────────────────────────────────────
// 大小寫不敏感比對。中文不需要 word boundary(會切)。
const BLOCKLIST_TERMS: string[] = [
  // 明顯成人/暴力英文詞(Stable Audio 是純 instrumental,但 prompt 本身仍會 leak 進公開描述)
  "porn", "pornographic", "sex", "sexual", "nude", "nudity",
  "rape", "kill", "murder", "torture", "suicide",
  "hentai", "loli", "shota",
  // 中文不雅
  "幹你", "媽的", "屌", "幹他媽", "操你", "肏",
  "色情", "做愛", "強姦", "自殺", "殺人",
  // 政治敏感 — 避免被當政治宣傳工具
  "習近平", "毛澤東", "蔣介石", "李登輝", "陳水扁", "馬英九", "蔡英文", "賴清德",
  "六四", "天安門", "法輪功", "達賴",
  "Xi Jinping", "Mao Zedong",
  // 品牌名 / 知名藝人 — 避免抄襲爭議
  "spotify", "apple music", "youtube music",
  "suno", "udio", "elevenlabs",
  "disney", "pixar", "marvel",
  "taylor swift", "beyonce", "drake", "billie eilish",
  "周杰倫", "張惠妹", "蕭敬騰", "五月天",
  "BTS", "Blackpink", "宇多田", "米津玄師",
];

interface ModerationResult {
  allowed: boolean;
  reason?: string;
  layer?: "blocklist" | "openai";
  /** 命中的關鍵詞或 OpenAI 分類,給 audit log / debug 用 */
  detail?: string;
}

/**
 * 判斷文字是否通過審核。
 * 多個 input 一起檢(prompt + title 之類),全部 pass 才回 allowed=true。
 */
export async function moderateMusicText(
  ...inputs: (string | null | undefined)[]
): Promise<ModerationResult> {
  // 整合所有 input,去掉 null / 空字串
  const texts = inputs
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
  if (texts.length === 0) return { allowed: true };

  // ── Layer 1:Blocklist ────────────────────────
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const term of BLOCKLIST_TERMS) {
      if (lower.includes(term.toLowerCase())) {
        return {
          allowed: false,
          reason: "blocklist_term",
          layer: "blocklist",
          detail: term,
        };
      }
    }
  }

  // ── Layer 2:OpenAI Moderation(可選) ────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: texts.join("\n---\n"),
        }),
      });

      if (!res.ok) {
        // OpenAI 失敗時放行(不要把整個生成流程卡死)— 但 log 給 ops
        console.error("[moderation] OpenAI returned", res.status);
        return { allowed: true };
      }

      const data = await res.json();
      const result = data?.results?.[0];
      if (result?.flagged) {
        // 找出第一個 true 的 category
        const cats = result.categories ?? {};
        const flaggedCat = Object.keys(cats).find((k) => cats[k] === true);
        return {
          allowed: false,
          reason: "openai_flagged",
          layer: "openai",
          detail: flaggedCat ?? "unknown",
        };
      }
    } catch (err) {
      console.error("[moderation] OpenAI threw:", err);
      // fallback 放行
    }
  }

  return { allowed: true };
}

/**
 * 直接給人類看的中文錯誤訊息(基於 reason / detail 翻譯)
 */
export function moderationMessage(result: ModerationResult, locale: "zh" | "en" | "ja" | "ko" = "zh"): string {
  if (result.allowed) return "";
  const generic = {
    zh: "這個描述詞不符合社群規範,請換一個寫法",
    en: "This description doesn't meet community guidelines",
    ja: "この説明はコミュニティガイドラインに違反しています",
    ko: "이 설명은 커뮤니티 가이드라인에 맞지 않습니다",
  };
  return generic[locale] ?? generic.zh;
}
