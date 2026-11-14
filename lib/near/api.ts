import { NextResponse } from "next/server";
import { NearError } from "./server";

export async function body<T = any>(request: Request): Promise<T> {
  const text = await request.text();
  if (text.length > 20_000) throw new NearError("Request too large", 413);
  try { return JSON.parse(text || "{}"); } catch { throw new NearError("Invalid JSON"); }
}
export function fail(error: unknown) {
  const status = error instanceof NearError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: status === 500 ? `Server error: ${message.slice(0, 200)}` : message }, { status });
}
// Best-effort per-isolate rate limit (prototype; use Cloudflare rate limiting rules in production).
const hits = new Map<string, number[]>();
export function limit(request: Request, bucket: string, max: number, windowMs = 60_000) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new NearError("Too many requests, wait a minute", 429);
  recent.push(now);
  hits.set(key, recent);
}
