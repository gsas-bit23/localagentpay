import { NextResponse } from "next/server";
import { quoteSchema } from "@/lib/validation";
import { merchants } from "@/lib/merchants";
import { createPaymentIntent } from "@/lib/near-intents";
import { apiError, readBody } from "@/lib/http";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const body = quoteSchema.parse(await readBody(request));
    const merchant = merchants.find((m) => m.id === body.merchantId);
    if (!merchant)
      return NextResponse.json({ error: "Unknown merchant." }, { status: 404 });
    // Price and recipient are server-owned, never supplied by the browser or LLM.
    return NextResponse.json(
      await createPaymentIntent(merchant, body.asset, body.mode),
    );
  } catch (error) {
    return apiError(error);
  }
}
