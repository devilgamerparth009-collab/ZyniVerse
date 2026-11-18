"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * The expensive half of the cursor glow. Only mounted by `CursorGlow` after
 * pointer/viewport/reduced-motion/idle checks pass, so the springs and their
 * animation loop never start on touch devices or during initial page load.
 */
export default function CursorGlowVisual() {
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 380, damping: 38, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 380, damping: 38, mass: 0.6 });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  return (
    <motion.div aria-hidden className="cursor-glow" style={{ left: sx, top: sy }}>
      <div className="cursor-glow-core" />
      <div className="cursor-glow-halo" />
    </motion.div>
  );
}
