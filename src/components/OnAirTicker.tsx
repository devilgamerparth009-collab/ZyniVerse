"use client";

import Link from "next/link";
import { bestTitle } from "@/lib/anilist";
import type { AiringScheduleEntry } from "@/lib/anilist";
import styles from "./OnAirTicker.module.css";

function TickerItem({
  item,
  idx,
  hidden,
}: {
  item: AiringScheduleEntry;
  idx: number;
  hidden?: boolean;
}) {
  return (
    <Link
      href={`/anime/${item.media.id}`}
      key={`${item.id}-${idx}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={styles.item}
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.title}>{bestTitle(item.media.title)}</span>
      <span className={styles.episode}>EP {item.episode}</span>
      <span className={styles.separator} aria-hidden>
        /
      </span>
    </Link>
  );
}

export default function OnAirTicker({ items }: { items: AiringScheduleEntry[] }) {
  if (!items || items.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Currently airing episodes">
      <div className="relative flex items-stretch">
        <div className={styles.badge}>
          <span className={styles.equalizer} aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span>ON AIR</span>
        </div>
        <div className={styles.window}>
          <div className={styles.track}>
            {items.map((item, idx) => (
              <TickerItem item={item} idx={idx} key={`a-${item.id}-${idx}`} />
            ))}
            {items.map((item, idx) => (
              <TickerItem
                item={item}
                idx={items.length + idx}
                hidden
                key={`b-${item.id}-${idx}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
