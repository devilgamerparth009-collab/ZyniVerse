"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/**
 * Loads the cursor glow only when it can actually be seen and used:
 *   - a fine pointer (no touch devices),
 *   - no reduced-motion preference,
 *   - a viewport large enough for the 520px halo,
 *   - after the browser is idle (never during first paint).
 *
 * CSS in globals.css keeps the same guard as a second line of defence.
 */
const CursorGlowVisual = dynamic(() => import("./CursorGlowVisual"), {
  ssr: false,
});

const MIN_VIEWPORT_WIDTH = 768;
const IDLE_TIMEOUT_MS = 1600;

export default function CursorGlow() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const finePointer = window.matchMedia?.("(pointer: fine)");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    let idleHandle: number | undefined;
    let disposed = false;

    const clearIdle = () => {
      if (idleHandle === undefined) return;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      idleHandle = undefined;
    };

    const evaluate = () => {
      if (disposed) return;
      clearIdle();
      const allowed =
        !!finePointer?.matches &&
        !reducedMotion?.matches &&
        window.innerWidth >= MIN_VIEWPORT_WIDTH &&
        document.visibilityState === "visible";

      if (!allowed) {
        setEnabled(false);
        return;
      }

      const enable = () => {
        if (!disposed) setEnabled(true);
      };
      if (typeof requestIdleCallback === "function") {
        idleHandle = requestIdleCallback(enable, { timeout: IDLE_TIMEOUT_MS });
      } else {
        idleHandle = window.setTimeout(enable, 200);
      }
    };

    evaluate();
    finePointer?.addEventListener?.("change", evaluate);
    reducedMotion?.addEventListener?.("change", evaluate);
    window.addEventListener("resize", evaluate, { passive: true });
    document.addEventListener("visibilitychange", evaluate);

    return () => {
      disposed = true;
      clearIdle();
      finePointer?.removeEventListener?.("change", evaluate);
      reducedMotion?.removeEventListener?.("change", evaluate);
      window.removeEventListener("resize", evaluate);
      document.removeEventListener("visibilitychange", evaluate);
    };
  }, []);

  return enabled ? <CursorGlowVisual /> : null;
}
