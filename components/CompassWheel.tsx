"use client";

/**
 * CompassWheel — 後天八卦羅盤,點按後旋轉、慢慢停定指出某方位。
 *
 * 設計:
 *   - 「指針」固定在最上方(N 12 點鐘方向),圓盤旋轉。
 *   - 八卦依後天八卦方位排列,以「現代地圖約定」北上、東右
 *       index 0 坎 (N , 0°) , 1 艮 (NE, 45°),  2 震 (E,  90°),  3 巽 (SE, 135°)
 *       index 4 離 (S , 180°), 5 坤 (SW, 225°), 6 兌 (W,  270°), 7 乾 (NW, 315°)
 *   - 圓盤順時針旋轉 X 度後,指針指向「原本位於 -X 角度」的扇區。
 *   - 動畫:Framer Motion 用 cubic-bezier ease-out,~3 秒停定。
 *
 * 隨機性:Math.random() 選 0..7,每次旋轉至少 4 整圈再加目標扇區角度,
 *        扇區內再加 ±15° jitter,看起來才不會像「整齊停在中線」的假樣。
 */

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { trigramNames } from "@/data/hexagrams";

// 後天八卦方位 — 從 12 點鐘(N)順時針列出 8 個
// (與 trigramNames 的 key 對應 — 方便之後 lookup)
const COMPASS_ORDER: { code: string; angle: number }[] = [
  { code: "010", angle: 0 },   // 坎 N
  { code: "001", angle: 45 },  // 艮 NE
  { code: "100", angle: 90 },  // 震 E
  { code: "011", angle: 135 }, // 巽 SE
  { code: "101", angle: 180 }, // 離 S
  { code: "000", angle: 225 }, // 坤 SW
  { code: "110", angle: 270 }, // 兌 W
  { code: "111", angle: 315 }, // 乾 NW
];

interface Props {
  /** 旋轉停定後回傳該方位的 trigram code(3-bit binary string)*/
  onResult: (trigramCode: string) => void;
  /** 是否禁用 spin 按鈕 — 避免重複點 */
  disabled?: boolean;
  /** 視覺尺寸(px),預設 320 */
  size?: number;
}

export default function CompassWheel({ onResult, disabled, size = 320 }: Props) {
  const { t } = useLanguage();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const accumulatedRotation = useRef(0);

  function spin() {
    if (spinning || disabled) return;
    setSpinning(true);

    // 隨機選一個方位
    const targetIndex = Math.floor(Math.random() * 8);
    const target = COMPASS_ORDER[targetIndex];

    // 圓盤要轉到「該扇區位於最上方」 → 圓盤旋轉量 = -target.angle(mod 360)
    // 加上至少 4 整圈、扇區內 ±18° jitter,讓視覺不要剛好停在中線
    const jitter = (Math.random() - 0.5) * 36; // ±18°
    const baseRotation = -target.angle + jitter;
    const fullSpins = 4 + Math.floor(Math.random() * 2); // 4 或 5 圈
    const finalRotation =
      accumulatedRotation.current + 360 * fullSpins + baseRotation;

    accumulatedRotation.current = finalRotation;
    setRotation(finalRotation);

    // 動畫結束時通報結果
    setTimeout(() => {
      setSpinning(false);
      onResult(target.code);
    }, 3200); // 對應下方 transition.duration
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
        }}
      >
        {/* 外圈光暈 */}
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(212,168,85,0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* 旋轉的圓盤 */}
        <motion.div
          animate={{ rotate: rotation }}
          transition={{
            duration: 3,
            ease: [0.17, 0.67, 0.3, 0.99], // easeOutCubicish
          }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(40,30,80,0.95) 0%, rgba(13,13,43,0.95) 60%, rgba(20,15,40,0.95) 100%)",
            border: "2px solid #d4a855",
            boxShadow:
              "0 0 32px rgba(212,168,85,0.35), inset 0 0 24px rgba(212,168,85,0.12)",
          }}
        >
          {/* 內圈裝飾線 */}
          <div
            style={{
              position: "absolute",
              inset: "10%",
              borderRadius: "50%",
              border: "1px dashed rgba(212,168,85,0.35)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "32%",
              borderRadius: "50%",
              border: "1px solid rgba(212,168,85,0.2)",
              background:
                "radial-gradient(circle, rgba(212,168,85,0.08) 0%, transparent 70%)",
            }}
          />

          {/* 八卦扇區 — 用八卦符號 + 方位文字 */}
          {COMPASS_ORDER.map((sec) => {
            const tg = trigramNames[sec.code];
            const tgName = t(tg.zh, tg.en, tg.ja, tg.ko);
            const direction = t(
              tg.directionZh,
              tg.directionEn,
              tg.directionJa,
              tg.directionKo
            );

            // 扇區中心位置 — 用三角函數放在 30% 半徑處
            const rad = (sec.angle - 90) * (Math.PI / 180); // -90 = 12 點鐘為 0
            const radius = size * 0.36;
            const cx = size / 2 + radius * Math.cos(rad);
            const cy = size / 2 + radius * Math.sin(rad);

            return (
              <div
                key={sec.code}
                style={{
                  position: "absolute",
                  left: cx,
                  top: cy,
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  width: size * 0.22,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    fontSize: size * 0.085,
                    color: "#d4a855",
                    lineHeight: 1,
                    marginBottom: 2,
                  }}
                >
                  {tg.symbol}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: size * 0.045,
                    color: "#fde68a",
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {tg.zh.split("（")[0]}
                  {/* 中文卦名單字部分 — 跨語系皆顯示中文卦名,
                      下方再給語系化的方位 + 短名 */}
                </div>
                <div
                  style={{
                    fontSize: size * 0.034,
                    color: "rgba(192,192,208,0.85)",
                    marginTop: 2,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {direction}
                </div>
                <div
                  style={{
                    fontSize: size * 0.03,
                    color: "rgba(212,168,85,0.7)",
                    marginTop: 1,
                    lineHeight: 1.2,
                  }}
                >
                  {/* 在 zh 環境下隱藏(已顯示中文卦名),其他語系顯示英文/日韓短名 */}
                  {t("", tgName, tgName, tgName).replace(/\s*\(.+\)/, "")}
                </div>
              </div>
            );
          })}

          {/* 中心太極點 */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: size * 0.12,
              height: size * 0.12,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #f0d78c 0%, #d4a855 60%, #8b6914 100%)",
              boxShadow:
                "0 0 16px rgba(240,215,140,0.6), inset 0 -2px 4px rgba(0,0,0,0.3)",
            }}
          />
        </motion.div>

        {/* 固定指針(在圓盤上方,12 點鐘方向) — 不參與旋轉 */}
        <div
          style={{
            position: "absolute",
            top: -2,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: `${size * 0.04}px solid transparent`,
            borderRight: `${size * 0.04}px solid transparent`,
            borderTop: `${size * 0.08}px solid #f0d78c`,
            filter: "drop-shadow(0 2px 4px rgba(212,168,85,0.6))",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      </div>

      {/* Spin 按鈕 */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning || disabled}
        style={{
          padding: "10px 28px",
          background:
            spinning || disabled
              ? "rgba(212,168,85,0.25)"
              : "linear-gradient(135deg, #d4a855, #f0d78c)",
          color: "#0a0a1a",
          border: "none",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 15,
          cursor: spinning || disabled ? "not-allowed" : "pointer",
          minWidth: 160,
          transition: "transform 0.15s",
        }}
      >
        {spinning
          ? t("羅盤旋轉中…", "Spinning…", "羅盤回転中…", "회전 중…")
          : t(
              "✦ 轉動羅盤",
              "✦ Spin the Compass",
              "✦ 羅盤を回す",
              "✦ 나침반 돌리기"
            )}
      </button>
    </div>
  );
}
