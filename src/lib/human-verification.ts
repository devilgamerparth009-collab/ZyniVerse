export const HUMAN_COOKIE = "zyni_human";
export const HUMAN_CHALLENGE_COOKIE = "zyni_human_chg";
export const HUMAN_COOKIE_MAX_AGE = 60 * 60 * 24;
export const HUMAN_CHALLENGE_MAX_AGE = 5 * 60;

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
}

async function hmac(input: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createChallenge(): Promise<{ token: string; nonce: string }> {
  const exp = Date.now() + HUMAN_CHALLENGE_MAX_AGE * 1000;
  const nonce = crypto.randomUUID();
  const payload = `${exp}.${nonce}`;
  const sig = await hmac(`chg.${payload}`);
  return { token: `${payload}.${sig}`, nonce };
}

export async function verifyChallenge(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !nonce || !sig) return null;
  const expected = await hmac(`chg.${expStr}.${nonce}`);
  if (!safeEqual(expected, sig)) return null;
  return nonce;
}

export async function createHumanToken(): Promise<string> {
  const exp = Date.now() + HUMAN_COOKIE_MAX_AGE * 1000;
  const nonce = crypto.randomUUID();
  const payload = `${exp}.${nonce}`;
  const sig = await hmac(`hum.${payload}`);
  return `${payload}.${sig}`;
}

export async function verifyHumanToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !nonce || !sig) return false;
  const expected = await hmac(`hum.${expStr}.${nonce}`);
  return safeEqual(expected, sig);
}

export async function expectedChallengeAnswer(nonce: string): Promise<string> {
  return sha256Hex(`human:${nonce}`);
}
