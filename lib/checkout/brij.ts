import { z } from "zod";
import { positiveAtomic, SOLANA_MAINNET, USDC_MINT } from "./types";
export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 422,
    public code = "CHECKOUT_ERROR",
  ) {
    super(message);
  }
}
const allowedTools = new Set([
  "brij_search_flights",
  "brij_get_flight_offer_details",
  "brij_get_flight_search_updates",
  "brij_search_hotels",
  "brij_get_hotel_rates",
  "brij_quote_hotel",
  "brij_create_flight_intent",
  "brij_create_hotel_intent",
  "brij_book_flight",
  "brij_book_hotel",
  "brij_get_intent",
  "brij_get_hotel_order",
  "brij_request_flight_refund",
  "brij_cancel_hotel",
]);
export async function brijCall(
  name: string,
  args: Record<string, unknown>,
  payment?: string,
  fetcher: typeof fetch = fetch,
) {
  if (!allowedTools.has(name))
    throw new CheckoutError("Unsupported commerce operation.", 400);
  const response = await fetcher("https://travel.brij.fi/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name,
        arguments: { ...args, ...(payment ? { x402_payment: payment } : {}) },
      },
    }),
    signal: AbortSignal.timeout(45000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new CheckoutError(
      response.status === 429
        ? "Travel search is busy. Please wait before trying again."
        : "The travel provider is temporarily unavailable.",
      response.status === 429 ? 429 : 503,
      "PROVIDER_UNAVAILABLE",
    );
  const text = await response.text();
  if (text.length > 2000000)
    throw new CheckoutError(
      "The provider returned too much data. Narrow your search.",
      502,
    );
  let rpc;
  try {
    rpc = JSON.parse(text);
  } catch {
    throw new CheckoutError(
      "The travel provider returned an unreadable response.",
      502,
    );
  }
  if (rpc.error)
    throw new CheckoutError(
      String(rpc.error.message || "The provider declined this request.").slice(
        0,
        500,
      ),
      422,
    );
  const result = rpc.result;
  let data = result?.structuredContent;
  if (!data) {
    const part = result?.content?.find(
      (part: { type: string }) => part.type === "text",
    );
    try {
      data = JSON.parse(part?.text || "{}");
    } catch {
      data = { error: part?.text || "Unknown provider response" };
    }
  }
  if (data?.x402Version === 2 && Array.isArray(data.accepts))
    return { paymentRequired: data, data: undefined };
  if (result?.isError || data?.error) {
    const e = data?.error;
    const message =
      typeof e === "string"
        ? e
        : e?.message ||
          data?.message ||
          "The provider could not complete this request.";
    throw new CheckoutError(
      String(message).slice(0, 500),
      422,
      String(data?.code || e?.code || "PROVIDER_ERROR"),
    );
  }
  if (!data || typeof data !== "object")
    throw new CheckoutError(
      "The travel provider returned an empty response.",
      502,
    );
  return { data: data as Record<string, any>, paymentRequired: undefined };
}
export function validateChallenge(
  challenge: unknown,
  intent: {
    expected_escrow_amount: unknown;
    expected_escrow_mint: unknown;
    escrow_address: unknown;
  },
  kind: "flight" | "hotel",
) {
  const parsed = z
    .object({
      x402Version: z.literal(2),
      resource: z
        .object({
          url: z.literal(
            `https://travel.brij.fi/${kind === "flight" ? "air" : "hotels"}/book`,
          ),
        })
        .passthrough(),
      accepts: z
        .array(
          z
            .object({
              scheme: z.literal("exact"),
              network: z.literal(SOLANA_MAINNET),
              asset: z.literal(USDC_MINT),
              amount: positiveAtomic,
              payTo: z.string(),
              maxTimeoutSeconds: z.number().positive().max(3600),
              extra: z.object({ feePayer: z.string() }).passthrough(),
            })
            .passthrough(),
        )
        .length(1),
    })
    .passthrough()
    .parse(challenge);
  const requirement = parsed.accepts[0];
  if (
    requirement.amount !==
      positiveAtomic.parse(intent.expected_escrow_amount) ||
    intent.expected_escrow_mint !== USDC_MINT ||
    requirement.payTo !== intent.escrow_address
  )
    throw new CheckoutError(
      "The payment request does not match this booking. No payment was authorized.",
      502,
      "PAYMENT_MISMATCH",
    );
  const extensions = parsed.extensions as Record<string, unknown> | undefined;
  return {
    x402Version: 2 as const,
    resource: { url: parsed.resource.url },
    accepts: [
      {
        scheme: requirement.scheme,
        network: requirement.network,
        asset: requirement.asset,
        amount: requirement.amount,
        payTo: requirement.payTo,
        maxTimeoutSeconds: requirement.maxTimeoutSeconds,
        extra: { feePayer: requirement.extra.feePayer },
      },
    ],
    extensions: {
      "payment-identifier": extensions?.["payment-identifier"] || {
        info: { required: true },
      },
    },
  };
}
