"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  coins: [number, number, number] | null;
  isFlipping: boolean;
}

export default function CoinAnimation({ coins, isFlipping }: Props) {
  return (
    <div style={{ display: "flex", gap: 24, justifyContent: "center", padding: "16px 0" }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: 64, height: 64, borderRadius: "50%",
            border: "2px solid rgba(212,168,85,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
            background: "radial-gradient(circle at 30% 30%, #f0d78c, #d4a855, #8b6914)",
            boxShadow: "0 0 15px rgba(212,168,85,0.3)",
          }}
          animate={isFlipping ? { rotateY: [0, 360, 720, 1080], scale: [1, 1.2, 1, 1.1, 1] } : {}}
          transition={{ duration: 1.2, delay: i * 0.15, ease: "easeInOut" }}
        >
          <AnimatePresence mode="wait">
            {coins && !isFlipping ? (
              <motion.span
                key={`result-${i}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ color: "#0a0a1a", fontWeight: 700, fontFamily: "'Noto Serif TC', serif" }}
              >
                {coins[i] === 3 ? "字" : "背"}
              </motion.span>
            ) : (
              <motion.span key={`coin-${i}`} style={{ color: "#0a0a1a", fontWeight: 700 }}>
                ☰
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
