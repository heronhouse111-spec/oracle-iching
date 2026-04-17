"use client";

import { motion } from "framer-motion";

interface Props {
  lines: number[];
  changingLines?: number[];
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

const sizes = {
  sm: { w: "80px", h: "6px", gap: 6, inner: 8 },
  md: { w: "128px", h: "10px", gap: 10, inner: 12 },
  lg: { w: "176px", h: "12px", gap: 12, inner: 16 },
};

export default function HexagramDisplay({ lines, changingLines = [], size = "md", animate = true }: Props) {
  const s = sizes[size];
  const display = [...lines].reverse();
  const changingDisplay = changingLines.map((i) => 5 - i);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: s.gap, alignItems: "center" }}>
      {display.map((line, idx) => {
        const isChanging = changingDisplay.includes(idx);
        const delay = animate ? idx * 0.15 : 0;
        const bg = isChanging
          ? "linear-gradient(90deg, #d4a855, #fde68a, #d4a855)"
          : "#d4a855";

        return (
          <motion.div
            key={idx}
            initial={animate ? { opacity: 0, scaleX: 0 } : false}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.4, delay }}
            style={{ width: s.w, position: "relative" }}
          >
            {line === 1 ? (
              <div style={{
                width: "100%", height: s.h, borderRadius: 2,
                background: bg,
                animation: isChanging ? "pulse 2s infinite" : undefined,
              }} />
            ) : (
              <div style={{ display: "flex", gap: s.inner, width: "100%" }}>
                <div style={{
                  flex: 1, height: s.h, borderRadius: 2,
                  background: bg,
                  animation: isChanging ? "pulse 2s infinite" : undefined,
                }} />
                <div style={{
                  flex: 1, height: s.h, borderRadius: 2,
                  background: bg,
                  animation: isChanging ? "pulse 2s infinite" : undefined,
                }} />
              </div>
            )}
            {isChanging && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.3 }}
                style={{
                  position: "absolute", right: -20, top: "50%", transform: "translateY(-50%)",
                  color: "#fde68a", fontSize: 12,
                }}
              >
                ○
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
