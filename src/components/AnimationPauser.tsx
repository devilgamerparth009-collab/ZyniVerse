"use client";

import { useEffect } from "react";

/**
 * Keeps the visual design intact while removing the main-thread cost of
 * infinite CSS animations.
 *
 * The old version called `getAnimations()` on every element in the document on
 * every rescan. On catalogue pages with thousands of cards that alone cost more
 * than the animations it was trying to pause. This version only inspects the
 * known "heavy motion" regions (neon borders, tickers, spinners, glows and
 * inline `animation:` styles), and defers the scan to idle time.
 *
 * Behaviour:
 *  1. Infinite animations on off-screen heavy regions are paused and resumed
 *     when they scroll back into view.
 *  2. After a short idle period every tracked animation sleeps; any real input
 *     wakes it.
 *  3. Everything pauses while the tab is hidden.
 *
 * One-shot entrance animations (framer-motion whileInView etc.) are untouched.
 */
const HEAVY_MOTION_SELECTOR = [
  "[style*='infinite']",
  "[style*='animation']",
  ".neon-rgb-border",
  ".neon-premium",
  ".glass-card",
  ".glass-badge",
  ".ticker",
  "[class*='ticker']",
  "[class*='spin']",
  "[class*='pulse']",
  "[class*='shimmer']",
  "[class*='aura']",
  "[class*='glow']",
  "[class*='scanline']",
  "[class*='particle']",
  "[class*='animate-']",
].join(",");

const IDLE_MS = 6000;
const SCAN_TIMEOUT_MS = 1800;

export default function AnimationPauser() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (document.visibilityState === "hidden") return;

    const animations = new Map<Element, Animation[]>();
    const visibleState = new WeakMap<Element, boolean>();
    let io: IntersectionObserver | null = null;
    let sleeping = false;
    let idleTimer: number | undefined;
    let scanHandle: number | undefined;
    let disposed = false;

    const isInfinite = (animation: Animation): boolean => {
      try {
        const timing = (animation.effect as KeyframeEffect | null)?.getComputedTiming?.();
        return !!timing && timing.iterations === Infinity;
      } catch {
        return false;
      }
    };

    const play = (animation: Animation) => {
      try {
        if (animation.playState === "paused") animation.play();
      } catch {
        /* detached animation */
      }
    };

    const pause = (animation: Animation) => {
      try {
        if (animation.playState === "running") animation.pause();
      } catch {
        /* detached animation */
      }
    };

    const applyAwake = () => {
      animations.forEach((anims, element) => {
        const visible = visibleState.get(element) ?? false;
        anims.forEach((animation) => (visible ? play(animation) : pause(animation)));
      });
    };

    const applySleep = () => {
      animations.forEach((anims) => anims.forEach(pause));
    };

    const scheduleIdle = () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (disposed || document.hidden) return;
        sleeping = true;
        applySleep();
      }, IDLE_MS);
    };

    const scan = () => {
      if (disposed) return;
      animations.forEach((anims) => anims.forEach(play));
      animations.clear();
      io?.disconnect();
      io = null;

      io = new IntersectionObserver(
        (entries) => {
          if (sleeping) return;
          for (const entry of entries) {
            visibleState.set(entry.target, entry.isIntersecting);
            const anims = animations.get(entry.target);
            if (!anims) continue;
            anims.forEach((animation) =>
              entry.isIntersecting ? play(animation) : pause(animation)
            );
          }
        },
        { rootMargin: "120px 0px" }
      );

      const viewportHeight = window.innerHeight;
      const seen = new Set<Element>();
      // Scoped query: bounded by the known animation owners instead of `*`.
      const candidates = document.querySelectorAll(HEAVY_MOTION_SELECTOR);
      for (const element of candidates) {
        if (seen.has(element)) continue;
        seen.add(element);

        let anims: Animation[];
        try {
          anims = element.getAnimations({ subtree: false });
        } catch {
          continue;
        }
        const infinite = anims.filter(isInfinite);
        if (infinite.length === 0) continue;

        animations.set(element, infinite);
        let nearViewport = false;
        try {
          const rect = element.getBoundingClientRect();
          nearViewport = rect.top < viewportHeight + 120 && rect.bottom > -120;
        } catch {
          nearViewport = false;
        }
        visibleState.set(element, nearViewport);
        io.observe(element);
      }

      if (sleeping) applySleep();
      else applyAwake();
    };

    const scanWhenIdle = () => {
      if (disposed) return;
      if (scanHandle !== undefined) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(scanHandle);
        else window.clearTimeout(scanHandle);
      }
      if (typeof requestIdleCallback === "function") {
        scanHandle = requestIdleCallback(() => scan(), { timeout: SCAN_TIMEOUT_MS });
      } else {
        scanHandle = window.setTimeout(scan, 240);
      }
    };

    const wake = () => {
      if (disposed || document.hidden) return;
      if (sleeping) {
        sleeping = false;
        applyAwake();
      }
      scheduleIdle();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        sleeping = true;
        applySleep();
      } else {
        sleeping = false;
        applyAwake();
        scheduleIdle();
        scanWhenIdle();
      }
    };

    const passive = { passive: true } as AddEventListenerOptions;
    const wakeEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    wakeEvents.forEach((event) => window.addEventListener(event, wake, passive));
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("load", scanWhenIdle);

    scanWhenIdle();
    scheduleIdle();

    return () => {
      disposed = true;
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      if (scanHandle !== undefined) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(scanHandle);
        else window.clearTimeout(scanHandle);
      }
      wakeEvents.forEach((event) => window.removeEventListener(event, wake));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("load", scanWhenIdle);
      io?.disconnect();
      animations.forEach((anims) => anims.forEach(play));
    };
  }, []);

  return null;
}
