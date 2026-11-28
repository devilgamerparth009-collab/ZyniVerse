import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { proxy } from "@/proxy";
import { HUMAN_COOKIE, createHumanToken } from "@/lib/human-verification";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const HUMAN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function makeRequest(url: string, userAgent?: string, method = "GET", cookie?: string) {
  const headers: Record<string, string> = {};
  if (userAgent !== undefined) headers["user-agent"] = userAgent;
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest(new Request(url, { method, headers }));
}

function makeEvent() {
  const waitUntil = vi.fn();
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
  return { event: { waitUntil } as unknown as NextFetchEvent, waitUntil };
}

function isNext(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

async function verifiedHumanRequest(url: string, userAgent = HUMAN, method = "GET") {
  const token = await createHumanToken();
  return makeRequest(url, userAgent, method, `${HUMAN_COOKIE}=${token}`);
}

describe("proxy - analytics ingest", () => {
  it("answers a known crawler with 204 so the route never runs", async () => {
    const { event } = makeEvent();
    const res = await proxy(makeRequest("https://zyverse.in/api/analytics/session", GOOGLEBOT, "POST"), event);
    expect(res.status).toBe(204);
  });

  it("answers a request without a User-Agent with 204", async () => {
    const { event } = makeEvent();
    const res = await proxy(makeRequest("https://zyverse.in/api/analytics/pageview", undefined, "POST"), event);
    expect(res.status).toBe(204);
  });

  it("lets a real browser through to the route", async () => {
    const { event } = makeEvent();
    const res = await proxy(makeRequest("https://zyverse.in/api/analytics/session", HUMAN, "POST"), event);
    expect(isNext(res)).toBe(true);
  });
});

describe("proxy - /forum/create", () => {
  it("answers a crawler with 404 so the page is never rendered", async () => {
    const { event } = makeEvent();
    const res = await proxy(makeRequest("https://zyverse.in/forum/create", GOOGLEBOT), event);
    expect(res.status).toBe(404);
  });

  it("keeps the form reachable for verified people", async () => {
    const { event } = makeEvent();
    const res = await proxy(await verifiedHumanRequest("https://zyverse.in/forum/create"), event);
    expect(isNext(res)).toBe(true);
  });

  it("does not touch the rest of /forum/ (indexed threads must keep working)", async () => {
    const { event } = makeEvent();
    const res = await proxy(makeRequest("https://zyverse.in/forum/thread/123", GOOGLEBOT), event);
    expect(isNext(res)).toBe(true);
  });
});

describe("proxy - crawler reporting", () => {
  it("reports a crawler hit on a content page", async () => {
    // Reporting is sampled (10% by default); pin it so this test is not flaky.
    const previous = process.env.BOT_HIT_REPORT_SAMPLE_RATE;
    process.env.BOT_HIT_REPORT_SAMPLE_RATE = "1";
    try {
      const { event, waitUntil } = makeEvent();
      await proxy(makeRequest("https://zyverse.in/anime/1", GOOGLEBOT), event);
      expect(waitUntil).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.BOT_HIT_REPORT_SAMPLE_RATE;
      else process.env.BOT_HIT_REPORT_SAMPLE_RATE = previous;
    }
  });

  it("does not report human traffic", async () => {
    const { event, waitUntil } = makeEvent();
    await proxy(await verifiedHumanRequest("https://zyverse.in/anime/1"), event);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

describe("proxy - noindex mirror protection", () => {
  const TRAINING_BOT = "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)";
  const SEO_BOT = "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)";

  it("hard-404s training/SEO crawlers before a mirror page is rendered", async () => {
    const { event, waitUntil } = makeEvent();
    for (const url of ["/character/123", "/staff/42", "/manga/9", "/manga/9/chapters"]) {
      for (const ua of [TRAINING_BOT, SEO_BOT, undefined]) {
        const res = await proxy(makeRequest(`https://zyverse.in${url}`, ua), event);
        expect(res.status).toBe(404);
        expect(res.headers.get("x-robots-tag")).toContain("noindex");
      }
    }
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("still lets discovery crawlers, social unfurlers and people through", async () => {
    const { event } = makeEvent();
    const twitter = "Twitterbot/1.0";
    for (const ua of [GOOGLEBOT, twitter, HUMAN]) {
      const res = await proxy(makeRequest("https://zyverse.in/character/123", ua), event);
      expect(isNext(res)).toBe(true);
    }
    const verified = await proxy(
      await verifiedHumanRequest("https://zyverse.in/manga/9"),
      event,
    );
    expect(isNext(verified)).toBe(true);
  });

  it("leaves section roots reachable", async () => {
    const { event } = makeEvent();
    for (const url of ["/character", "/staff", "/manga"]) {
      const res = await proxy(makeRequest(`https://zyverse.in${url}`, TRAINING_BOT), event);
      expect(res.status).not.toBe(404);
    }
  });
});

describe("proxy - bot cookie for ad slots", () => {
  it("flags a known crawler with zyni_bot=1", async () => {
    const { event } = makeEvent();
    const res = await proxy(makeRequest("https://zyverse.in/anime/1", GOOGLEBOT), event);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("zyni_bot=1");
  });

  it("never sets the cookie for a real visitor", async () => {
    const { event } = makeEvent();
    const res = await proxy(await verifiedHumanRequest("https://zyverse.in/anime/1"), event);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("clears a stale bot cookie once the request looks human", async () => {
    const { event } = makeEvent();
    const token = await createHumanToken();
    const request = new NextRequest(
      new Request("https://zyverse.in/anime/1", {
        headers: { "user-agent": HUMAN, cookie: `zyni_bot=1; ${HUMAN_COOKIE}=${token}` },
      })
    );
    const res = await proxy(request, event);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("zyni_bot=");
    expect(setCookie.toLowerCase()).toContain("expires=thu, 01 jan 1970");
  });
});
