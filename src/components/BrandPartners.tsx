"use client";

import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

type Partner = {
  name: string;
  desc: string;
  href: string;
  emoji: string;
  color: string;
  status: string;
  statusColor: string;
  logo?: string;
};

const partners: Partner[] = [
  {
    name: "AnimeSoul Official",
    desc: "Dedicated anime community page — daily reels, edits, news and fan content from the anime world.",
    href: "https://www.instagram.com/theanimesoulofficial/",
    logo: "/partners/animesoulofficial.jpg",
    emoji: "🤝",
    color: "#29f2e0",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Anime Vortex",
    desc: "Manga, anime and manhwa recommendations — daily recs and updates every week.",
    href: "https://www.instagram.com/vort.exme/",
    logo: "/partners/anime-vortex.jpg",
    emoji: "🌀",
    color: "#a855f7",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "AnimeSama",
    desc: "Anime community page — reels, edits and fan content for the anime squad.",
    href: "https://www.instagram.com/animesama._/",
    logo: "/partners/animesama.jpg",
    emoji: "🤝",
    color: "#f59e0b",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Oii Tanjiro",
    desc: "Anime edits, memes and fan content — daily dose of anime on your feed.",
    href: "https://www.instagram.com/_oii_tanjiro/",
    logo: "/partners/oii_tanjiro.jpg",
    emoji: "⚔️",
    color: "#38bdf8",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Velvet Voice Sneha",
    desc: "Hindi anime dubbing and voice-over content — bringing characters to life in Hindi.",
    href: "https://www.instagram.com/velvetvoice.sneha/",
    logo: "/partners/voicesneha.jpg",
    emoji: "🎙️",
    color: "#e879f9",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Jo Yuri",
    desc: "Anime community page — reels, edits and fan content for otaku squad.",
    href: "https://www.instagram.com/jo_yuri_77__/",
    logo: "/partners/yuri.jpg",
    emoji: "🌸",
    color: "#fb7185",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Piyush Muse",
    desc: "Anime content creator — reels, reviews and fan community for Indian anime fans.",
    href: "https://www.instagram.com/piyushmuse/",
    logo: "/partners/piyush.jpg",
    emoji: "🎬",
    color: "#34d399",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Its EB",
    desc: "Anime edits and fan content — daily anime posts for the community.",
    href: "https://www.instagram.com/its_eb_18/",
    logo: "/partners/eb.jpg",
    emoji: "✨",
    color: "#c084fc",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
  {
    name: "Voice of Viishu",
    desc: "Anime in Hindi — dubbing clips, voice-over reels and dialogues brought to life in Hindi.",
    href: "https://www.instagram.com/voice_of_viishu/",
    logo: "/partners/voice-of-viishu.jpg",
    emoji: "🎙️",
    color: "#f472b6",
    status: "Community Partner",
    statusColor: "#22c55e",
  },
];

function PartnerTile({ p, index }: { p: Partner; index: number }) {
  return (
    <Link
      href={p.href}
      title={p.desc}
      className="cpart-card"
      style={
        {
          "--cpart-accent": p.color,
          "--cpart-status": p.statusColor,
          "--cpart-i": index,
        } as CSSProperties
      }
    >
      <span className="cpart-glow" aria-hidden="true" />
      <span className="cpart-sheen" aria-hidden="true" />
      <span className="cpart-avatar">
        {p.logo ? (
          <Image src={p.logo} alt="" fill sizes="(max-width: 640px) 48px, 60px" className="cpart-img" />
        ) : (
          <span className="cpart-emoji" aria-hidden="true">{p.emoji}</span>
        )}
      </span>
      <span className="cpart-copy">
        <span className="cpart-name">{p.name}</span>
        <span className="cpart-desc">{p.desc}</span>
        <span className="cpart-status">
          <span className="cpart-status-dot" aria-hidden="true" />
          {p.status}
        </span>
      </span>
      <span className="cpart-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}

export default function BrandPartners() {
  return (
    <section className="cpart-section">
      <div className="cpart-frame">
        <span className="cpart-orb cpart-orb--a" aria-hidden="true" />
        <span className="cpart-orb cpart-orb--b" aria-hidden="true" />
        <div className="cpart-inner">
          <div className="cpart-head">
            <div>
              <p className="cpart-eyebrow">
                <span className="cpart-eyebrow-dot" aria-hidden="true" />
                Community
              </p>
              <h2 className="cpart-title">
                Community Partners
                <span className="cpart-count">{partners.length} partners</span>
              </h2>
              <p className="cpart-sub">
                Creators and pages building the anime community with us.
              </p>
            </div>
            <span className="cpart-connected">
              <span className="cpart-connected-dot" aria-hidden="true" />
              Connected
            </span>
          </div>

          <div className="cpart-grid">
            {partners.map((p, i) => (
              <PartnerTile key={p.name} p={p} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
