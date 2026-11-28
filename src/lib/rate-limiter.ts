import { NextResponse } from "next/server";
import type { RedisClientType } from "redis";
import { logError } from "@/lib/logger";
import { getClientIp as getClientIpFromRequest } from "@/lib/request-ip";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(configName: string) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const store = stores.get(configName);
  if (!store) return;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

let redisClient: RedisClientType | null = null;
let redisAvailable = false;

async function initRedis() {
  if (redisClient) return;
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    const redis = await import("redis");
    redisClient = redis.createClient({ url: redisUrl });
    redisClient.on("error", (err) => {
      logError(err);
      redisAvailable = false;
    });
    await redisClient.connect();
    redisAvailable = true;
  } catch (err) {
    logError(err);
    redisAvailable = false;
  }
}

initRedis();

function makeRedisKey(name: string, ip: string): string {
  return `ratelimit:${name}:${ip}`;
}

export function createRateLimiter(name: string, config: Partial<RateLimitConfig> = {}) {
  const { maxRequests = 60, windowMs = 60 * 1000 } = config as RateLimitConfig;

  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  const prefixedName = `rate_${name}`;

  return {
    async check(ip: string): Promise<{ allowed: boolean; remaining: number }> {
      if (redisAvailable && redisClient) {
        try {
          const key = makeRedisKey(prefixedName, ip);
          const count = await redisClient.incr(key);
          if (count === 1) {
            await redisClient.pExpire(key, windowMs);
          }
          if (count > maxRequests) {
            return { allowed: false, remaining: 0 };
          }
          return { allowed: true, remaining: Math.max(0, maxRequests - count) };
        } catch {
          redisAvailable = false;
        }
      }
      return this.checkSync(ip);
    },

    checkSync(ip: string): { allowed: boolean; remaining: number } {
      cleanup(name);
      const now = Date.now();
      let entry = store.get(ip);
      if (!entry || entry.resetAt < now) {
        entry = { count: 1, resetAt: now + windowMs };
        store.set(ip, entry);
        return { allowed: true, remaining: maxRequests - 1 };
      }
      if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0 };
      }
      entry.count++;
      return { allowed: true, remaining: maxRequests - entry.count };
    },

    getClientIp(request: Request): string {
      return getClientIpFromRequest(request);
    },

    async middleware(request: Request): Promise<NextResponse | null> {
      const ip = this.getClientIp(request);
      // Redis-aware. When REDIS_URL is configured this enforces a single global
      // counter across every serverless instance; without it `check()` falls
      // back to the per-instance `checkSync`. Previously this always used the
      // in-memory path, so adding Redis had no effect on the routes that matter.
      const result = await this.check(ip);
      if (!result.allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(windowMs / 1000)),
              "X-RateLimit-Limit": String(maxRequests),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }
      return null;
    },

    getStore() {
      return store;
    },

    reset() {
      store.clear();
    },

    getStats() {
      return {
        size: store.size,
        config: { maxRequests, windowMs },
        redisAvailable,
      };
    },
  };
}

export const apiLimiter = createRateLimiter("api", {
  maxRequests: 30,
  windowMs: 60 * 1000,
});

export const authLimiter = createRateLimiter("auth", {
  // Login, signup, verification and password-reset endpoints share this bucket.
  // 10/min blocked real users who retried OAuth or resent a verification email.
  maxRequests: 30,
  windowMs: 60 * 1000,
});

export const anilistLimiter = createRateLimiter("anilist", {
  maxRequests: 30,
  windowMs: 60 * 1000,
});

export const affiliateLimiter = createRateLimiter("affiliate", {
  maxRequests: 30,
  windowMs: 60 * 1000,
});

export const passwordResetLimiter = createRateLimiter("password-reset", {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});
