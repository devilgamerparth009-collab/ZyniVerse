import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
// Import route modules up front: on a loaded CI/workstation the on-demand
// transform of these modules (and their transitive Prisma/Next graph) can take
// longer than the 15s per-test timeout. A static import moves that cost outside
// the timed test body and keeps these API contract checks deterministic.
import { GET as getStreaming } from "@/app/api/streaming/route";
import { GET as getQuizGenerate } from "@/app/api/quiz/generate/route";

function createNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, { ...init, headers: new Headers(init?.headers) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/streaming", () => {
  it("returns 400 when title is missing", async () => {
    const res = await getStreaming(createNextRequest("http://localhost:3000/api/streaming"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("title query parameter is required");
  });

  it("returns sources for a known anime", async () => {
    const res = await getStreaming(createNextRequest("http://localhost:3000/api/streaming?title=Naruto"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.sources.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown anime", async () => {
    const res = await getStreaming(createNextRequest("http://localhost:3000/api/streaming?title=UnknownAnime123"));
    const json = await res.json();
    expect(json.sources).toEqual([]);
  });
});

describe("GET /api/quiz/generate", () => {
  it("returns quiz questions stripped of correctAnswer", async () => {
    const res = await getQuizGenerate(createNextRequest("http://localhost:3000/api/quiz/generate"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.questions).toBeDefined();
    if (json.questions.length > 0) {
      expect(json.questions[0]).not.toHaveProperty("correctAnswer");
      expect(json.questions[0]).toHaveProperty("question");
      expect(json.questions[0]).toHaveProperty("options");
    }
  });

  it("respects count parameter", async () => {
    const res = await getQuizGenerate(createNextRequest("http://localhost:3000/api/quiz/generate?count=3"));
    const json = await res.json();
    expect(json.questions.length).toBeLessThanOrEqual(3);
  });
});
