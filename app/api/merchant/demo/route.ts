import { NextResponse } from "next/server";
import { demoMerchantAct } from "@/lib/near/server";
import { body, fail, limit } from "@/lib/near/api";

/** Lets judges act as one of the demo merchants (testnet). Real merchants sign with their own key. */
export async function POST(request: Request) {
  try {
    limit(request, "merchant", 20);
    const { merchant, action, orderId } = await body<{ merchant: string; action: string; orderId: number }>(request);
    if (action !== "confirm" && action !== "refund") return NextResponse.json({ error: "action must be confirm or refund" }, { status: 400 });
    if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ error: "Bad order id" }, { status: 400 });
    const result = await demoMerchantAct(String(merchant), action, orderId);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) { return fail(error); }
}
