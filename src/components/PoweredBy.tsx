"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, type CSSProperties } from "react";
import { amazonSearchUrl, playasiaUrl } from "@/lib/affiliate-config";

type CardItem = {
  name: string;
  desc: string;
  badge: string;
  color: string;
  logo: string;
  href?: string;
};

const cards: CardItem[] = [
  {
    name: "Google Student Ambassador Program",
    desc: "Student Ambassador, India — sharing the power of Gemini with campuses.",
    badge: "Powered by Gemini",
    color: "#29f2e0",
    logo: "/partners/gemini.png",
  },
  {
    name: "GeeksforGeeks Campus Mantri Program",
    desc: "Campus Mantri (Ambassador) — official campus representative of GeeksforGeeks.",
    badge: "Campus Mantri",
    color: "#22c55e",
    logo: "/partners/gfg.svg",
  },
  {
    name: "Physics Wallah Channel Partner",
    desc: "Official PW Channel Partner — helping students learn, grow and score.",
    badge: "PW Channel Partner",
    color: "#8a5cff",
    logo: "/partners/pw.webp",
  },
  {
    name: "Amazon",
    desc: "Anime picks, manga and more on Amazon.in.",
    badge: "Affiliate link",
    color: "#ff9900",
    logo: "/partners/amazon.svg",
    href: amazonSearchUrl("anime"),
  },
  {
    name: "Play-Asia",
    desc: "Anime merch, games and collectibles.",
    badge: "Affiliate link",
    color: "#29f2e0",
    logo: "/partners/play-asia.png",
    href: playasiaUrl(),
  },
];

function vars(values: Record<string, string | number>) {
  return values as CSSProperties;
}

function PartnerCard({ item, index }: { item: CardItem; index: number }) {
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const py = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    el.style.setProperty("--pwr-rx", `${(-py * 4).toFixed(2)}deg`);
    el.style.setProperty("--pwr-ry", `${(px * 4).toFixed(2)}deg`);
  }, []);

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    el.style.setProperty("--pwr-rx", "0deg");
    el.style.setProperty("--pwr-ry", "0deg");
  }, []);

  const content = (
    <>
      <span className="pwr-card-scan" aria-hidden="true" />
      <div className="pwr-card-top">
        <span className="pwr-card-rule" aria-hidden="true" />
        <span className="pwr-badge">{item.badge}</span>
      </div>
      <div className="pwr-logo">
        <Image
          src={item.logo}
          alt={`${item.name} logo`}
          fill
          sizes="68px"
          className="pwr-logo-img"
        />
      </div>
      <h3 className="pwr-card-name">{item.name}</h3>
      <p className="pwr-card-desc">{item.desc}</p>
      <span className="pwr-card-corner" aria-hidden="true" />
      {item.href && <span className="pwr-card-go" aria-hidden="true">↗</span>}
    </>
  );

  const style = vars({ "--pwr-i": index, "--pwr-accent": item.color });
  const handlers = {
    onPointerMove: handlePointerMove,
    onPointerLeave: handlePointerLeave,
  };

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="pwr-card pwr-card--link"
        style={style}
        {...handlers}
      >
        {content}
      </a>
    );
  }

  return (
    <article className="pwr-card" style={style} {...handlers}>
      {content}
    </article>
  );
}

export default function PoweredBy() {
  return (
    <section className="pwr-section" aria-labelledby="pwr-title">
      <span className="pwr-halo" aria-hidden="true" />
      <span className="pwr-beam" aria-hidden="true" />

      <div className="pwr-shell">
        <header className="pwr-header">
          <p className="pwr-eyebrow">
            <span className="pwr-signal" aria-hidden="true" />
            Powered By
          </p>
          <h2 id="pwr-title" className="pwr-title">Programs &amp; Partners</h2>
        </header>

        <div className="pwr-grid">
          {cards.map((item, index) => (
            <PartnerCard key={item.name} item={item} index={index} />
          ))}
        </div>

        <p className="pwr-disclosure">
          Amazon and Play-Asia cards use affiliate links. We may earn a small commission at no extra cost to you.{" "}
          <Link href="/disclaimer">Details</Link>
        </p>
      </div>
    </section>
  );
}
