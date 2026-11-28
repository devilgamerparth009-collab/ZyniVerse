"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export default function SidebarReveal({
  children,
  index = 0,
}: {
  children: ReactNode;
  index?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`mdt-side-reveal${visible ? " is-visible" : ""}`}
      style={{ "--mdt-side-delay": `${Math.min(index, 7) * 0.045}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
