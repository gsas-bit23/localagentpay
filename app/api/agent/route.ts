import { NextResponse } from "next/server";
import { getMerchants } from "@/lib/near/views";
import { planWithNearAI } from "@/lib/agent/near-ai";
import { body, fail, limit } from "@/lib/near/api";

export async function POST(request: Request) {
  try {
    limit(request, "agent", 20);
    const input = await body<{ message?: string; location?: { lat: number; lon: number } }>(request);
    const message = String(input.message || "").trim().slice(0, 500);
    if (message.length < 2) return NextResponse.json({ error: "Tell the agent what you need" }, { status: 400 });
    const loc = input.location && Number.isFinite(input.location.lat) && Number.isFinite(input.location.lon) ? input.location : undefined;
    const merchants = await getMerchants();
    return NextResponse.json(await planWithNearAI(message, merchants, loc));
  } catch (error) { return fail(error); }
}
