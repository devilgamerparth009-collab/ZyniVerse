"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function SimilarTitlesReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={ref}
      className={`mdt-similar mx-auto my-8 max-w-7xl px-4 sm:px-6${visible ? " is-visible" : ""}`}
      aria-label="Similar manga and anime"
    >
      {children}
    </nav>
  );
}
