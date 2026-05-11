"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { hexagrams, trigramNames } from "@/data/hexagrams";
import { trigramImageKey } from "@/lib/ichingImages";
import CollectionProgress from "@/components/CollectionProgress";
import RedemptionModal, { type RedemptionResult } from "@/components/RedemptionModal";
import NewCardToast from "@/components/NewCardToast";

interface Props {
  /** key 是 hexagram.number 字串 ("1" .. "64"),value 是 storage 上的圖 url */
  images: Record<string, string>;
  /** 每組(10 張)可換的點數,從 server 端 getCreditCost("REDEEM_DUPLICATE_RATE") 拿 */
  redeemRate: number;
}

const SECTIONS = [
  { titleKey: "upper" as const, range: [1, 30] as const },
  { titleKey: "lower" as const, range: [31, 64] as const },
];

const REDEEM_THRESHOLD = 10;

interface ModalState {
  collectionType: "iching" | "iching_trigram";
  cardId: string;
  cardName: string;
  cardImageUrl: string;
  currentCount: number;
}

export default function HexagramsIndexView({ images, redeemRate }: Props) {
  const { t } = useLanguage();
  // 未登入時:全彩預覽模式(讓使用者一眼看到價值,觸發登入收藏慾望)
  // 已登入時:Pokédex 模式 — owned 才彩色,未抽到的灰階
  // 兩個 CollectionProgress(hexagram + trigram)都會回拋 authenticated,任一條為 false 即視為未登入
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  // hexagram 重複次數:cardId('1'..'64') → 抽到次數
  const [hexCounts, setHexCounts] = useState<Map<string, number>>(new Map());
  // 八卦 trigram 收藏 — 跟 hexagram 分開的 collection_type='iching_trigram'
  // 抽到的途徑只有方位卦象合參(/iching/direction-hexagram)
  const [ownedTrigrams, setOwnedTrigrams] = useState<Set<string>>(new Set());
  const [trigramCounts, setTrigramCounts] = useState<Map<string, number>>(new Map());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<{
    type: "iching" | "iching_trigram";
    cardName: string;
    credits: number;
  } | null>(null);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
        >
          {t(
            "易經 64 卦完整介紹",
            "I Ching · 64 Hexagrams",
            "易経 64卦 完全解説",
            "주역 64괘 백과"
          )}
        </h1>
        <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8 }}>
          {t(
            "King Wen 周易序列 · 卦辭 / 象辭 / 白話翻譯",
            "King Wen sequence · judgments, images, vernacular",
            "周易順序 · 卦辞 / 象辞 / 現代訳",
            "주역 순서 · 괘사 / 상사 / 현대 번역"
          )}
        </p>
        <p
          style={{
            color: "rgba(192,192,208,0.7)",
            fontSize: 13,
            marginTop: 12,
            lineHeight: 1.7,
            maxWidth: 640,
            margin: "12px auto 0",
          }}
        >
          {t(
            "64 卦由八卦兩兩相重而成。每卦皆附原文卦辭、象辭,以及白話翻譯。從乾坤起手,到既濟未濟收尾,層層展開人生與宇宙的結構。",
            "The 64 hexagrams emerge from pairs of the 8 trigrams. Each entry includes the classical judgment, image text, and a plain-language translation — opening from Qian/Kun and closing with Ji-Ji/Wei-Ji.",
            "64卦は八卦を二つずつ重ねて成り立ちます。各卦には原文の卦辞・象辞と現代訳を併載。乾坤から始まり既済未済まで、人生と宇宙の構造を層を成して描き出します。",
            "64괘는 8괘를 두 개씩 겹쳐 만들어집니다. 각 괘마다 원문 괘사와 상사, 그리고 현대 번역을 수록했습니다. 건곤에서 기제·미제까지, 인생과 우주의 구조를 단계적으로 펼칩니다."
          )}
        </p>
      </header>

      {/* 收藏進度 — Pokémon 圖鑑式 */}
      <CollectionProgress
        type="iching"
        total={64}
        onLoaded={(d) => {
          setAuthed(d.authenticated);
          setOwnedIds(d.ownedIds);
          setHexCounts(d.obtainCounts);
        }}
      />

      {/* 卜卦規則 */}
      <section
        style={{
          background: "rgba(13,13,43,0.55)",
          border: "1px solid rgba(212,168,85,0.25)",
          borderRadius: 14,
          padding: 24,
          marginBottom: 36,
        }}
      >
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 20,
            color: "#d4a855",
            marginBottom: 12,
          }}
        >
          {t("如何卜卦", "How to Divine", "卜卦の方法", "점치는 법")}
        </h2>
        <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85 }}>
          {t(
            "傳統卜卦使用三枚銅錢,連續擲六次,自下而上得六爻成卦。每次三枚錢的正反組合決定爻是「老陰、少陰、少陽、老陽」其中之一,老陰 / 老陽即為「變爻」,會由「本卦」變化出「之卦」。",
            "Toss three coins six times; the bottom toss is line one, the top toss is line six. Each toss yields one of: Old Yin, Young Yin, Young Yang, Old Yang. Old Yin and Old Yang are 'changing lines' — they transform the primary hexagram into a relating hexagram, revealing direction of change.",
            "三枚の銅貨を六回投げ、下から順に六爻を作ります。それぞれの組み合わせで「老陰・少陰・少陽・老陽」のいずれかが決まり、老陰と老陽は「変爻」として本卦から之卦を生み出し、変化の方向を示します。",
            "동전 세 개를 여섯 번 던져 아래에서 위로 여섯 효를 만듭니다. 매번의 조합으로 노음·소음·소양·노양 중 하나가 결정되며, 노음과 노양은 '변효'가 되어 본괘에서 지괘로 변화의 방향을 보여줍니다."
          )}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Link
            href="/"
            style={{
              padding: "8px 18px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ✦ {t("直接開始易經占卜", "Start I Ching Reading", "易経占いを始める", "주역 점 시작")}
          </Link>
          <Link
            href="/iching/yes-no"
            style={{
              padding: "8px 18px",
              background: "transparent",
              color: "#d4a855",
              border: "1px solid #d4a855",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            {t("Yes/No 一卦速答", "Yes/No I Ching", "Yes/No 一卦速答", "Yes/No 주역")}
          </Link>
        </div>
      </section>

      {/* 八卦對照 — 含後天八卦方位、人事、事理、占斷提示 */}
      <section style={{ marginBottom: 36 }}>
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 20,
            color: "#d4a855",
            marginBottom: 6,
            borderLeft: "3px solid #d4a855",
            paddingLeft: 12,
          }}
        >
          {t("八卦速覽", "The Eight Trigrams", "八卦速見表", "팔괘 속람")}
        </h2>
        <p
          style={{
            color: "rgba(192,192,208,0.65)",
            fontSize: 12,
            marginLeft: 14,
            marginBottom: 18,
            lineHeight: 1.7,
          }}
        >
          {t(
            "後天八卦(文王八卦)方位 — 占卜時用以定「事之所在」,合參卦象見事情如何演變。集滿 8 卦的途徑只有「方位卦象合參」占法。",
            "Later-Heaven (King Wen) directions — locate the matter in space, then read the hexagram for how it unfolds. The only way to collect all 8 trigrams is via the Direction-Hexagram divination.",
            "後天八卦(文王八卦)の方位 — 占卜では「事の在処」を定め、卦象と合わせて変化を読みます。8卦を集める唯一の方法は「方位卦象合参」占法です。",
            "후천팔괘(문왕팔괘) 방위 — 점복 시 '일이 있는 곳'을 정하고 괘상과 합쳐 흐름을 읽습니다. 8괘를 모두 모으는 길은 '방위·괘상 합참' 점법뿐입니다."
          )}
        </p>

        {/* 八卦收藏進度 — collection_type='iching_trigram',透過方位卦象合參收集 */}
        <CollectionProgress
          type="iching_trigram"
          total={8}
          onLoaded={(d) => {
            // 雙保險:兩個 CollectionProgress 都回拋 authenticated,任一為 false 即視為未登入
            setAuthed(d.authenticated);
            setOwnedTrigrams(d.ownedIds);
            setTrigramCounts(d.obtainCounts);
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {Object.entries(trigramNames).map(([code, tg]) => {
            const owned = ownedTrigrams.has(code);
            // 未登入(或 API 還沒回)→ 全彩預覽,讓圖鑑像 marketing window;登入後維持 Pokédex 模式
            const showInColor = authed === false || authed === null ? true : owned;
            const tgCount = trigramCounts.get(code) ?? 0;
            const canRedeemTg = tgCount >= REDEEM_THRESHOLD && redeemRate > 0;
            const imgUrl = images[trigramImageKey(code)];
            const tgName = t(tg.zh, tg.en, tg.ja, tg.ko);
            const direction = t(
              tg.directionZh,
              tg.directionEn,
              tg.directionJa,
              tg.directionKo
            );
            const people = t(tg.peopleZh, tg.peopleEn, tg.peopleJa, tg.peopleKo);
            const matters = t(
              tg.mattersZh,
              tg.mattersEn,
              tg.mattersJa,
              tg.mattersKo
            );
            const advice = t(tg.adviceZh, tg.adviceEn, tg.adviceJa, tg.adviceKo);
            return (
              <div
                key={code}
                title={
                  owned
                    ? undefined
                    : t(
                        "未收集 — 用方位卦象合參占卜抽到此卦才會解鎖",
                        "Not collected — unlock by drawing this trigram via Direction-Hexagram divination",
                        "未収集 — 方位卦象合参の占いでこの卦を引くと解錠されます",
                        "미수집 — 방위·괘상 합참 점에서 이 괘를 뽑으면 해제됩니다"
                      )
                }
                style={{
                  background: showInColor ? "rgba(13,13,43,0.5)" : "rgba(13,13,43,0.35)",
                  border: canRedeemTg
                    ? "1px solid rgba(110,231,183,0.55)"
                    : showInColor
                    ? "1px solid rgba(212,168,85,0.15)"
                    : "1px solid rgba(212,168,85,0.08)",
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "76px 1fr",
                  gap: 12,
                  alignItems: "start",
                  opacity: showInColor ? 1 : 0.55,
                  transition: "opacity 0.2s",
                  position: "relative",
                  boxShadow: canRedeemTg
                    ? "0 0 16px rgba(110,231,183,0.15)"
                    : undefined,
                }}
              >
                {/* ×N 重複收集徽章 — 抽到 ≥2 次才顯示(避免初次收集時干擾視覺) */}
                {owned && tgCount >= 2 && (
                  <span
                    title={t(
                      `已抽到 ${tgCount} 次`,
                      `Drawn ${tgCount} times`,
                      `${tgCount} 回引いた`,
                      `${tgCount}회 뽑음`
                    )}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: "linear-gradient(135deg,#d4a855,#fde68a)",
                      color: "#0a0a1a",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 9999,
                      boxShadow: "0 2px 6px rgba(212,168,85,0.45)",
                      lineHeight: 1.4,
                      zIndex: 2,
                    }}
                  >
                    ×{tgCount}
                  </span>
                )}
                {/* 兌換 pill — 持有 ≥10 才出現 */}
                {canRedeemTg && (
                  <button
                    type="button"
                    onClick={() =>
                      setModal({
                        collectionType: "iching_trigram",
                        cardId: code,
                        cardName: tgName,
                        cardImageUrl: imgUrl ?? "",
                        currentCount: tgCount,
                      })
                    }
                    title={t(
                      `用 10 張兌換 ${redeemRate} 點`,
                      `Redeem 10 cards for ${redeemRate} credits`,
                      `10 枚で ${redeemRate} ポイント交換`,
                      `10장으로 ${redeemRate} 포인트 교환`
                    )}
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      background: "linear-gradient(135deg,#6ee7b7,#34d399)",
                      color: "#0a0a1a",
                      border: "none",
                      borderRadius: 9999,
                      padding: "3px 9px",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      zIndex: 3,
                      boxShadow: "0 2px 8px rgba(110,231,183,0.4)",
                      lineHeight: 1.4,
                    }}
                  >
                    ↺ {t("兌換", "Redeem", "交換", "교환")}
                  </button>
                )}
                {/* 圖片框 — 仿 64 卦 9:14 直幅;未收集套灰階 */}
                <div
                  style={{
                    width: 76,
                    aspectRatio: "9 / 14",
                    borderRadius: 6,
                    overflow: "hidden",
                    border: "1px solid rgba(212,168,85,0.2)",
                    background:
                      "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.5))",
                    flexShrink: 0,
                    filter: showInColor ? "none" : "grayscale(1) brightness(0.55)",
                  }}
                >
                  {imgUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl}
                      alt={tgName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 18, color: "#d4a855", lineHeight: 1 }}>
                      {tg.symbol}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Noto Serif TC', serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#fde68a",
                      }}
                    >
                      {tgName}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(212,168,85,0.85)",
                        background: "rgba(212,168,85,0.12)",
                        padding: "1px 8px",
                        borderRadius: 100,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {direction}
                    </span>
                  </div>

                  <dl
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#c0c0d0",
                      lineHeight: 1.6,
                      display: "grid",
                      rowGap: 4,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      <dt
                        style={{
                          color: "rgba(212,168,85,0.7)",
                          fontSize: 11,
                          flexShrink: 0,
                          minWidth: 36,
                        }}
                      >
                        {t("人事", "People", "人事", "인사")}
                      </dt>
                      <dd style={{ margin: 0 }}>{people}</dd>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <dt
                        style={{
                          color: "rgba(212,168,85,0.7)",
                          fontSize: 11,
                          flexShrink: 0,
                          minWidth: 36,
                        }}
                      >
                        {t("事理", "Matters", "事理", "사리")}
                      </dt>
                      <dd style={{ margin: 0 }}>{matters}</dd>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <dt
                        style={{
                          color: "rgba(212,168,85,0.7)",
                          fontSize: 11,
                          flexShrink: 0,
                          minWidth: 36,
                        }}
                      >
                        {t("提示", "Advice", "助言", "조언")}
                      </dt>
                      <dd style={{ margin: 0, color: "#e8e8f0" }}>{advice}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 上經 / 下經 */}
      {SECTIONS.map((sec) => {
        const items = hexagrams.filter(
          (h) => h.number >= sec.range[0] && h.number <= sec.range[1]
        );
        const title =
          sec.titleKey === "upper"
            ? t("上經", "Upper Canon", "上経", "상경")
            : t("下經", "Lower Canon", "下経", "하경");
        const desc =
          sec.titleKey === "upper"
            ? t(
                "天道與君子立身",
                "Heaven, nature, and the foundations of the gentleman",
                "天道と君子の立身",
                "천도와 군자의 입신"
              )
            : t(
                "人事與變化終始",
                "Human affairs, change, and final outcomes",
                "人事と変化の終始",
                "인사와 변화의 시종"
              );
        return (
          <section key={sec.titleKey} style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 22,
                color: "#d4a855",
                marginBottom: 6,
                borderLeft: "3px solid #d4a855",
                paddingLeft: 12,
              }}
            >
              {title}
              <span style={{ opacity: 0.5, fontSize: 13, marginLeft: 12 }}>
                ({items.length})
              </span>
            </h2>
            <p
              style={{
                color: "rgba(192,192,208,0.6)",
                fontSize: 12,
                marginLeft: 14,
                marginBottom: 18,
              }}
            >
              {desc}
            </p>

            <div
              style={{
                display: "grid",
                // 跟 /tarot/cards 同 grid 設定:auto-fill 140px、間距 16
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 16,
              }}
            >
              {items.map((h) => {
                const url = images[String(h.number)];
                const hName = t(
                  h.nameZh,
                  h.nameEn.split(" ")[0],
                  h.nameJa,
                  h.nameKo
                );
                const numLabel = t(
                  `第 ${h.number} 卦`,
                  `Hexagram ${h.number}`,
                  `第${h.number}卦`,
                  `제 ${h.number}괘`
                );
                const owned = ownedIds.has(String(h.number));
                // 未登入(或 API 還沒回)→ 全彩預覽;登入後維持 Pokédex 模式
                const showInColor = authed === false || authed === null ? true : owned;
                const obtainCount = hexCounts.get(String(h.number)) ?? 0;
                const canRedeem = obtainCount >= REDEEM_THRESHOLD && redeemRate > 0;
                return (
                  <Link
                    key={h.number}
                    href={`/iching/hexagrams/${h.number}`}
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: "inherit",
                      background: showInColor
                        ? "rgba(13,13,43,0.5)"
                        : "rgba(13,13,43,0.35)",
                      border: canRedeem
                        ? "1px solid rgba(110,231,183,0.55)"
                        : showInColor
                        ? "1px solid rgba(212,168,85,0.4)"
                        : "1px solid rgba(212,168,85,0.1)",
                      borderRadius: 10,
                      padding: 8,
                      position: "relative",
                      transition: "transform 0.2s, border-color 0.2s, filter 0.3s",
                      boxShadow: canRedeem
                        ? "0 0 16px rgba(110,231,183,0.15)"
                        : undefined,
                    }}
                  >
                    {/* 角標:抽到 1 次 → ✓;抽到 ≥2 次 → ×N(取代 ✓ 避免重複) */}
                    {owned && (
                      <span
                        title={
                          obtainCount >= 2
                            ? t(
                                `已抽到 ${obtainCount} 次`,
                                `Drawn ${obtainCount} times`,
                                `${obtainCount} 回引いた`,
                                `${obtainCount}회 뽑음`
                              )
                            : t("已收藏", "Collected", "収集済み", "수집 완료")
                        }
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          minWidth: 18,
                          height: 18,
                          borderRadius: 9999,
                          background: "linear-gradient(135deg,#d4a855,#fde68a)",
                          color: "#0a0a1a",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: obtainCount >= 2 ? "0 6px" : 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 2,
                          boxShadow: "0 2px 6px rgba(212,168,85,0.45)",
                        }}
                      >
                        {obtainCount >= 2 ? `×${obtainCount}` : "✓"}
                      </span>
                    )}
                    {/* 兌換 pill — 持有 ≥10 才出現 */}
                    {canRedeem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setModal({
                            collectionType: "iching",
                            cardId: String(h.number),
                            cardName: hName,
                            cardImageUrl: url ?? "",
                            currentCount: obtainCount,
                          });
                        }}
                        title={t(
                          `用 10 張兌換 ${redeemRate} 點`,
                          `Redeem 10 cards for ${redeemRate} credits`,
                          `10 枚で ${redeemRate} ポイント交換`,
                          `10장으로 ${redeemRate} 포인트 교환`
                        )}
                        style={{
                          position: "absolute",
                          bottom: 6,
                          right: 6,
                          background: "linear-gradient(135deg,#6ee7b7,#34d399)",
                          color: "#0a0a1a",
                          border: "none",
                          borderRadius: 9999,
                          padding: "3px 9px",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          zIndex: 3,
                          boxShadow: "0 2px 8px rgba(110,231,183,0.4)",
                          lineHeight: 1.4,
                        }}
                      >
                        ↺ {t("兌換", "Redeem", "交換", "교환")}
                      </button>
                    )}
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "9 / 14",
                        borderRadius: 6,
                        overflow: "hidden",
                        marginBottom: 6,
                        border: "1px solid rgba(212,168,85,0.2)",
                        background:
                          "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.5))",
                        // 未收藏 → 灰階 + 半透明(未登入時 showInColor 永遠為 true,維持全彩預覽)
                        filter: showInColor ? "none" : "grayscale(1) brightness(0.55)",
                      }}
                    >
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={hName}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: showInColor ? "#e8e8f0" : "rgba(192,192,208,0.45)",
                        lineHeight: 1.4,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 10, color: showInColor ? "rgba(212,168,85,0.7)" : "rgba(192,192,208,0.4)" }}>
                        {numLabel}
                      </div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontFamily: "'Noto Serif TC', serif",
                          marginTop: 2,
                        }}
                      >
                        {hName}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      {modal && (
        <RedemptionModal
          open={true}
          collectionType={modal.collectionType}
          cardId={modal.cardId}
          cardName={modal.cardName}
          cardImageUrl={modal.cardImageUrl}
          currentCount={modal.currentCount}
          rate={redeemRate}
          onClose={() => setModal(null)}
          onSuccess={(result: RedemptionResult) => {
            // 更新對應 collection 的本地 count(讓 ×N pill 立即反映)
            if (modal.collectionType === "iching") {
              setHexCounts((prev) => {
                const next = new Map(prev);
                next.set(modal.cardId, result.countAfter);
                return next;
              });
            } else {
              setTrigramCounts((prev) => {
                const next = new Map(prev);
                next.set(modal.cardId, result.countAfter);
                return next;
              });
            }
            setToast({
              type: modal.collectionType,
              cardName: modal.cardName,
              credits: result.creditsGranted,
            });
            setModal(null);
          }}
        />
      )}

      {/* 兌換成功 toast — 沿用 NewCardToast 的「重複卡」橘色變體 */}
      <NewCardToast
        show={toast !== null}
        type={toast?.type ?? "iching"}
        isNew={false}
        cardName={
          toast
            ? t(
                `已兌換 ${toast.cardName} ×10`,
                `Redeemed ${toast.cardName} ×10`,
                `${toast.cardName} ×10 を交換`,
                `${toast.cardName} ×10 교환 완료`
              )
            : ""
        }
        collectionCount={
          toast?.type === "iching_trigram" ? ownedTrigrams.size : ownedIds.size
        }
        total={toast?.type === "iching_trigram" ? 8 : 64}
        rewardCredits={toast?.credits ?? 0}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
