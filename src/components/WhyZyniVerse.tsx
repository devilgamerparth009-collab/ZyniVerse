import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./WhyZyniVerse.module.css";

const features = [
  {
    icon: "🗺️",
    title: "Watch Order",
    desc: "40+ curated franchise guides",
    link: "/watch-order",
    color: "#29f2e0",
  },
  {
    icon: "⏭️",
    title: "Filler Guide",
    desc: "Community-voted canon tracker",
    link: "/filler",
    color: "#ff2d78",
  },
  {
    icon: "📺",
    title: "Indian TV Schedule",
    desc: "20+ channels, live timings",
    link: "/tv-schedule",
    color: "#8b5cf6",
  },
  {
    icon: "🇮🇳",
    title: "Hindi / Tamil / Telugu",
    desc: "Indian dub tracking",
    link: "/dubbed?language=hindi",
    color: "#ff9933",
  },
  {
    icon: "🏆",
    title: "Anime Challenges",
    desc: "Join seasonal & yearly",
    link: "/challenges",
    color: "#ff2d78",
  },
  {
    icon: "📸",
    title: "Cosplay Gallery",
    desc: "Upload & explore",
    link: "/cosplay",
    color: "#29f2e0",
  },
  {
    icon: "🎨",
    title: "Fan Art Gallery",
    desc: "Share your creations",
    link: "/fanart",
    color: "#ff6b35",
  },
];

export default function WhyZyniVerse() {
  return (
    <section className={styles.section}>
      {/* Header */}
      <div className={styles.head}>
        <p className={styles.eyebrow}>⚡ Why ZyniVerse?</p>
        <h2 className={styles.title}>Not just another anime list.</h2>
        <span className={styles.titleUnderline} aria-hidden />
      </div>

      {/* Cards Grid */}
      <div className={styles.grid}>
        {features.map((f, index) => (
          <Link
            key={f.link}
            href={f.link}
            className={styles.feature}
            style={
              {
                "--accent": f.color,
                "--tile-index": index,
              } as CSSProperties
            }
          >
            <div className={styles.tileTop}>
              <span className={styles.icon} aria-hidden>{f.icon}</span>
              <span className={styles.arrow} aria-hidden>→</span>
            </div>
            <p className={styles.featureTitle}>{f.title}</p>
            <p className={styles.featureDesc}>{f.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
