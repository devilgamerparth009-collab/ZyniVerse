/**
 * Server-side Supabase Realtime Broadcast over plain HTTP.
 *
 * Used instead of a websocket so it is safe inside a serverless function: one
 * request, no long-lived socket, and it works on Vercel where the socket.io
 * server in `server.ts` cannot run.
 *
 * The publishable ("anon") key is enough to publish to a public channel. That
 * key ships in the browser bundle, so treat every channel as readable by
 * anyone who knows its topic name: never put private content in a payload.
 * Topics are cuid-based and unguessable, and DM payloads carry only a pointer
 * (see `toRealtimeNotification` in `src/lib/chat.ts`).
 */
export function realtimeConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function broadcastRealtime(
  topics: string | string[],
  event: string,
  payload: unknown,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !key) return;

  const list = Array.isArray(topics) ? topics : [topics];
  if (list.length === 0) return;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: list.map((topic) => ({ topic, event, payload, private: false })),
    }),
    // Never let a slow realtime hop hold a user's request open.
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) {
    throw new Error(`Supabase realtime broadcast failed: ${res.status}`);
  }
}
