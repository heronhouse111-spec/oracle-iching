"use client";

/**
 * IchingMethodSelectView — 易經占卜方法選擇頁的 client view。
 *
 * 仿 /tarot-spread index 風格,列出目前 app 提供的易經占卜入口。
 * 同一個 cast 動作,可走不同卜法;有些走全卦六爻,有些走 Yes/No,
 * 新加的「方位卦象合參」是兩段式占法,進階層級。
 *
 * 切語系 useLanguage().t() 直接 re-render,免 round-trip。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

interface MethodEntry {
  id: string;
  href: string;
  /** 卡片左上小編號 */
  badgeZh: string;
  badgeEn: string;
  /** 名稱多語 */
  nameZh: string;
  nameEn: string;
  nameJa: string;
  nameKo: string;
  /** 一句話 tagline 多語 */
  taglineZh: string;
  taglineEn: string;
  taglineJa: string;
  taglineKo: string;
  /** badge tier — 跟 /iching/methods 同色系 */
  tier: "main" | "instant" | "advanced";
}

const METHODS: MethodEntry[] = [
  {
    id: "main",
    href: "/",
    badgeZh: "全",
    badgeEn: "Full",
    nameZh: "全卦六爻 · 三錢法",
    nameEn: "Full Hexagram · Three-Coin",
    nameJa: "全卦六爻 · 三銭法",
    nameKo: "전괘 육효 · 삼전법",
    taglineZh: "六次擲錢成完整卦象，AI 為你詳細解卦並結合動爻看走向",
    taglineEn:
      "Six tosses for a complete hexagram, with AI walking through the judgment, image, and changing lines",
    taglineJa: "六回投げて完全な卦を成し、AIが卦辞・象辞・動爻を踏まえて読み解く",
    taglineKo: "여섯 번 던져 완전한 괘를 이루고, AI가 괘사·상사·동효를 종합해 풀이",
    tier: "main",
  },
  {
    id: "plum-blossom",
    href: "/iching/plum-blossom",
    badgeZh: "梅",
    badgeEn: "Plum",
    nameZh: "梅花易數 · 時間起卦",
    nameEn: "Plum Blossom · Time Casting",
    nameJa: "梅花易数 · 時間起卦",
    nameKo: "매화역수 · 시간 기괘",
    taglineZh: "宋代邵雍創 — 不擲錢，用問事當下的時間直接起卦，AI 解讀含動爻變化",
    taglineEn:
      "Created by Shao Yong — no coins; cast a hexagram from the current time and let the AI read it",
    taglineJa: "宋代の邵雍が創始 — 銭を投げず、問いを立てた時刻から卦を起こし、AIが読み解く",
    taglineKo: "송대 소옹이 창안 — 동전 없이 질문 시점의 시간으로 괘를 세우고 AI가 풀이",
    tier: "instant",
  },
  {
    id: "direction-hexagram",
    href: "/iching/direction-hexagram",
    badgeZh: "進",
    badgeEn: "Adv",
    nameZh: "方位卦象合參",
    nameEn: "Direction × Hexagram",
    nameJa: "方位 × 卦象 合参",
    nameKo: "방위 × 괘상 합참",
    taglineZh: "兩段式占法 — 先卜方位定「事在何方、應於誰」，再卜全卦看「事如何走」",
    taglineEn:
      "Two-stage method — divine the direction (where and who), then the full hexagram (how it unfolds)",
    taglineJa: "二段階の占法 — 先に方位で「どこで、誰に」を定め、後に全卦で「どう運ぶか」を見る",
    taglineKo: "두 단계 점법 — 먼저 방위로 '어디서, 누구'를 정하고, 이후 전괘로 '어떻게 흐를지'를 봅니다",
    tier: "advanced",
  },
];

const TIER_BADGE: Record<
  MethodEntry["tier"],
  { bg: string; color: string; labelZh: string; labelEn: string; labelJa: string; labelKo: string }
> = {
  main: {
    bg: "rgba(212,168,85,0.18)",
    color: "#fde68a",
    labelZh: "主流程",
    labelEn: "Main",
    labelJa: "メイン",
    labelKo: "메인",
  },
  instant: {
    bg: "rgba(139,92,246,0.18)",
    color: "#c4b5fd",
    labelZh: "即時",
    labelEn: "Instant",
    labelJa: "即時",
    labelKo: "즉시",
  },
  advanced: {
    bg: "rgba(99,179,237,0.18)",
    color: "#93c5fd",
    labelZh: "進階",
    labelEn: "Advanced",
    labelJa: "上級",
    labelKo: "심화",
  },
};

const MIND_NOTES: { zh: string; en: string; ja: string; ko: string }[] = [
  {
    zh: "占卜貴在誠與靜 — 焚香或靜坐片刻，把問題在心中明確化再開始。",
    en: "Divination requires sincerity and stillness — sit quietly for a moment and bring the question into focus before you begin.",
    ja: "占卜は誠と静を貴ぶ — 香を焚くかしばし静坐し、問いを心に明確にしてから始める。",
    ko: "점은 성실함과 고요함을 귀히 여깁니다 — 잠시 정좌하여 질문을 마음에 분명히 한 뒤 시작하세요.",
  },
  {
    zh: "問題宜具體，例如「此次合作能否順利」勝過「我最近運勢如何」。",
    en: "Make the question concrete — 'Will this collaboration go smoothly?' beats 'How is my luck lately?'",
    ja: "質問は具体的に — 「今回の協業は順調に進むか」のほうが「最近の運勢はどうか」より良い。",
    ko: "질문은 구체적으로 — '이번 협업이 순조로울 것인가'가 '요즘 내 운세가 어떨까'보다 낫습니다.",
  },
];

export default function IchingMethodSelectView() {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <header style={{ textAlign: "center", marginBottom: 24 }}>
        <h1
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {t(
            "選擇易經占卜方式",
            "Choose an I Ching Method",
            "易経占卜の方法を選ぶ",
            "주역 점법 선택"
          )}
        </h1>
        <p
          style={{
            color: "rgba(192,192,208,0.75)",
            fontSize: 13,
            marginTop: 16,
            lineHeight: 1.75,
            maxWidth: 560,
            margin: "16px auto 0",
          }}
        >
          {t(
            "不同問題適合不同占法 — 全卦六爻看深度脈絡、梅花易數用時間直接起卦、方位卦象合參用兩段式合看「在哪裡」+「怎麼走」。",
            "Different questions call for different methods. Full hexagram for depth, plum blossom for casting from time alone, direction × hexagram for a two-stage look at 'where' and 'how'.",
            "質問によって適切な占法は異なります。全卦六爻は深い脈絡、梅花易数は時刻から直接立卦、方位×卦象は二段で「どこ」と「どう」を見る。",
            "질문마다 어울리는 점법이 다릅니다. 전괘 육효는 깊은 흐름, 매화역수는 시간만으로 기괘, 방위·괘상 합참은 '어디서'와 '어떻게'를 두 단계로."
          )}
        </p>
      </header>

      {/* 心法提醒 — 占卜前的提示 */}
      <section
        style={{
          background: "rgba(13,13,43,0.55)",
          border: "1px solid rgba(212,168,85,0.22)",
          borderRadius: 12,
          padding: 18,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: "rgba(212,168,85,0.7)",
            marginBottom: 10,
          }}
        >
          {t(
            "占卜前 · 心法提醒",
            "BEFORE YOU BEGIN · MIND NOTES",
            "占卜前 · 心法",
            "시작하기 전 · 마음가짐"
          )}
        </div>
        <ul
          style={{
            margin: 0,
            padding: "0 0 0 18px",
            color: "#e8e8f0",
            fontSize: 13.5,
            lineHeight: 1.85,
          }}
        >
          {MIND_NOTES.map((note, i) => (
            <li key={i}>{t(note.zh, note.en, note.ja, note.ko)}</li>
          ))}
        </ul>
      </section>

      {/* 占法清單 — 每個都是進入點 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {METHODS.map((m) => {
          const tierBadge = TIER_BADGE[m.tier];
          const tierLabel = t(
            tierBadge.labelZh,
            tierBadge.labelEn,
            tierBadge.labelJa,
            tierBadge.labelKo
          );
          const name = t(m.nameZh, m.nameEn, m.nameJa, m.nameKo);
          const tagline = t(m.taglineZh, m.taglineEn, m.taglineJa, m.taglineKo);

          return (
            <Link
              key={m.id}
              href={m.href}
              style={{
                display: "block",
                background: "rgba(13,13,43,0.55)",
                border: "1px solid rgba(212,168,85,0.22)",
                borderRadius: 14,
                padding: 18,
                textDecoration: "none",
                color: "inherit",
                transition: "transform 0.2s, border-color 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(212,168,85,0.15)",
                    color: "#d4a855",
                    fontSize: 14,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Noto Serif TC', serif",
                    flexShrink: 0,
                  }}
                >
                  {t(m.badgeZh, m.badgeEn, m.badgeZh, m.badgeZh)}
                </span>
                <h2
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 19,
                    color: "#d4a855",
                    margin: 0,
                    flex: "1 1 auto",
                    minWidth: 0,
                  }}
                >
                  {name}
                </h2>
                <span
                  style={{
                    background: tierBadge.bg,
                    color: tierBadge.color,
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 100,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tierLabel}
                </span>
              </div>
              <p
                style={{
                  color: "rgba(192,192,208,0.85)",
                  fontSize: 13.5,
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                {tagline}
              </p>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(212,168,85,0.7)",
                }}
              >
                {t("開始 →", "Begin →", "始める →", "시작 →")}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 連到方法介紹頁 */}
      <section
        style={{
          marginTop: 32,
          textAlign: "center",
          padding: "20px 16px",
          background: "rgba(13,13,43,0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212,168,85,0.18)",
        }}
      >
        <p
          style={{
            color: "rgba(192,192,208,0.75)",
            fontSize: 13,
            marginBottom: 10,
            lineHeight: 1.6,
          }}
        >
          {t(
            "想多了解每種占法的歷史與儀式感?",
            "Want to learn the history and ritual feel of each method?",
            "各占法の歴史と儀式性を知りたい?",
            "각 점법의 역사와 의식성을 알고 싶나요?"
          )}
        </p>
        <Link
          href="/iching/methods"
          style={{
            color: "#d4a855",
            fontSize: 14,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {t(
            "卜卦方式介紹 →",
            "I Ching Methods Reference →",
            "卜卦の方法 →",
            "주역 점치는 법 →"
          )}
        </Link>
      </section>
    </div>
  );
}
