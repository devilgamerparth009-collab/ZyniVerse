"use client";

import { useEffect, useRef } from "react";

/**
 * Canvas aurora embers: slow-drifting glowing particles (cyan/magenta/violet)
 * that softly twinkle. Positioned absolutely inside a relative parent.
 *
 * The previous version set `shadowBlur` on every particle on every frame,
 * which forces the browser to build a blur layer per ember — the single most
 * expensive thing on the homepage. Here each colour is pre-rendered once into a
 * small radial-gradient sprite and blitted with `drawImage`. The loop is also
 * capped at ~30fps and stops entirely when the canvas is off screen or the tab
 * is hidden. The visual is unchanged: soft glowing embers drifting upward.
 */
const COLORS = ["34,211,238", "232,121,249", "217,70,239", "255,255,255"];

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  colorIndex: number;
  twinkle: number;
  phase: number;
};

function makeGlowSprite(color: string): HTMLCanvasElement {
  const size = 32;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, `rgba(${color},0.95)`);
  gradient.addColorStop(0.3, `rgba(${color},0.5)`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

export default function AuroraParticles({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 640) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const sprites = COLORS.map(makeGlowSprite);

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let running = false;
    let disposed = false;
    let lastFrame = 0;
    let onScreen = true;
    let observer: IntersectionObserver | null = null;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = rect?.width || window.innerWidth;
      height = rect?.height || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ~24 embers max instead of 50. With pre-rendered glows this is visually
      // the same field at a fraction of the paint cost.
      const count = Math.min(24, Math.max(10, Math.floor((width * height) / 48000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(0.1 + Math.random() * 0.32),
        colorIndex: Math.floor(Math.random() * COLORS.length),
        twinkle: 0.4 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      // 30fps is plenty for slow-drifting embers and halves the paint work.
      if (now - lastFrame < 32) return;
      lastFrame = now;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      const time = now / 1000;
      for (const particle of particles) {
        particle.x += particle.vx + Math.sin(time * 0.6 + particle.phase) * 0.14;
        particle.y += particle.vy;
        if (particle.y < -12) {
          particle.y = height + 12;
          particle.x = Math.random() * width;
        }
        if (particle.x < -12) particle.x = width + 12;
        if (particle.x > width + 12) particle.x = -12;

        const alpha = 0.18 + Math.abs(Math.sin(time * particle.twinkle + particle.phase)) * 0.45;
        const size = particle.r * 9;
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          sprites[particle.colorIndex],
          particle.x - size / 2,
          particle.y - size / 2,
          size,
          size
        );
      }
      ctx.globalAlpha = 1;
    };

    const start = () => {
      if (running || disposed || document.hidden || !onScreen) return;
      running = true;
      lastFrame = 0;
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const sync = () => {
      if (document.hidden || !onScreen) stop();
      else start();
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting);
          sync();
        },
        { rootMargin: "80px 0px" }
      );
      observer.observe(canvas);
    }

    start();

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
    />
  );
}
