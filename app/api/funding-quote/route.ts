import { NextResponse } from "next/server";
import { dryQuote, FUNDING_ORIGINS, type FundingOrigin } from "@/lib/near/intents";
import { toUnits } from "@/lib/near/config";
import { body, fail, limit } from "@/lib/near/api";

export async function POST(request: Request) {
  try {
    limit(request, "quote", 15);
    const input = await body<{ origin: string; amount: string; recipient?: string }>(request);
    if (!(input.origin in FUNDING_ORIGINS)) return NextResponse.json({ error: "Unsupported origin" }, { status: 400 });
    const units = toUnits(String(input.amount || ""));
    if (BigInt(units) < 1_000_000n || BigInt(units) > 1_000_000_000n) return NextResponse.json({ error: "Preview 1-1000 USDC" }, { status: 400 });
    const recipient = input.recipient && /^[a-z0-9._-]{2,64}\.near$|^[0-9a-f]{64}$/.test(input.recipient) ? input.recipient : "intents.near";
    return NextResponse.json(await dryQuote(input.origin as FundingOrigin, units, recipient));
  } catch (error) { return fail(error); }
}
