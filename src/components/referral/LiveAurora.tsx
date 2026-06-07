import { motion } from "framer-motion";

/**
 * Living aurora background — iOS 26 / 27 "Liquid Glass" vibe.
 * Three slow-drifting color blobs behind a deep canvas, plus a subtle grain.
 * Used as the page-level backdrop for referral surfaces.
 */
export const LiveAurora = ({ tone = "indigo" }: { tone?: "indigo" | "rose" | "mint" }) => {
  const palette = {
    indigo: { a: "#7c5cff", b: "#22d3ee", c: "#ff7ab6", bg: "#070712" },
    rose: { a: "#ff6f91", b: "#ffb86b", c: "#a78bfa", bg: "#0b0710" },
    mint: { a: "#34d399", b: "#22d3ee", c: "#a78bfa", bg: "#06100d" },
  }[tone];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: palette.bg }}
    >
      <motion.div
        className="absolute -left-[20%] -top-[20%] h-[70vmax] w-[70vmax] rounded-full opacity-60 mix-blend-screen blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${palette.a}, transparent 70%)` }}
        animate={{ x: [0, 80, -40, 0], y: [0, 60, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[15%] top-[10%] h-[60vmax] w-[60vmax] rounded-full opacity-55 mix-blend-screen blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${palette.b}, transparent 70%)` }}
        animate={{ x: [0, -90, 50, 0], y: [0, 40, -70, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-[25%] left-[20%] h-[65vmax] w-[65vmax] rounded-full opacity-50 mix-blend-screen blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${palette.c}, transparent 70%)` }}
        animate={{ x: [0, 60, -80, 0], y: [0, -50, 40, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Vignette + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,transparent,rgba(0,0,0,0.55))]" />
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
};

export default LiveAurora;
