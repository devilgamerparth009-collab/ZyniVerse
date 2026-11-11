// Cleans up garbled characters, strips HTML entities, and normalizes macrons/accents to plain English.
export function cleanText(text?: string | null): string {
  if (!text) return '';
  return text
    // HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Unicode smart quotes and dashes
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013/g, ' - ')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2026/g, '...')
    // Strip unprintable control characters (keep emojis and normal text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

export function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

// Forum posts come from the website as light markdown. Render them as clean
// plain text on mobile instead of showing raw **asterisks** and `backticks`.
export function stripMarkdown(text?: string | null): string {
  if (!text) return '';
  const cleaned = cleanText(text);
  return cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .trim();
}

export function formatScore(score?: number): string {
  if (!score) return '--';
  return (score / 10).toFixed(1);
}

export function getScoreColor(score?: number): string {
  if (!score) return '#94a3b8';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#22d3ee';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function getFillerColor(percentage: number): string {
  if (percentage <= 10) return '#22c55e';
  if (percentage <= 30) return '#f59e0b';
  return '#ef4444';
}

export function getEpisodeTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'canon':
    case 'manga_canon':
      return '#22c55e';
    case 'mixed':
    case 'mostly_canon':
      return '#f59e0b';
    case 'filler':
      return '#ef4444';
    default:
      return '#64748b';
  }
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'watching': return '#22c55e';
    case 'completed': return '#3b82f6';
    case 'planning': return '#f59e0b';
    case 'dropped': return '#ef4444';
    case 'paused': return '#94a3b8';
    default: return '#64748b';
  }
}

export function getStatusColorForCode(status: string): string {
  switch (status.toUpperCase()) {
    case 'CURRENT':
    case 'REWATCHING':
      return '#22c55e';
    case 'COMPLETED':
      return '#3b82f6';
    case 'PLANNING':
      return '#f59e0b';
    case 'DROPPED':
      return '#ef4444';
    case 'PAUSED':
      return '#94a3b8';
    default:
      return '#64748b';
  }
}

export const LIST_STATUS_LABEL: Record<string, string> = {
  CURRENT: 'Watching',
  REWATCHING: 'Rewatching',
  COMPLETED: 'Completed',
  PLANNING: 'Planning',
  DROPPED: 'Dropped',
  PAUSED: 'Paused',
};

export function animeTitle(anime?: {
  title?: { english?: string | null; romaji?: string | null; native?: string | null; userPreferred?: string | null } | null;
} | null): string {
  if (!anime?.title) return 'Unknown';
  const raw = (
    anime.title.english ||
    anime.title.romaji ||
    anime.title.userPreferred ||
    anime.title.native ||
    'Unknown'
  );
  // AniList titles are already proper UTF-8 — just trim, no cleanText needed
  return raw.trim();
}

export function animePoster(anime?: {
  coverImage?: { large?: string | null; medium?: string | null; extraLarge?: string | null } | null;
} | null): string | undefined {
  return (
    anime?.coverImage?.extraLarge ||
    anime?.coverImage?.large ||
    anime?.coverImage?.medium ||
    undefined
  );
}

export function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatAirDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCount(n?: number | null): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
