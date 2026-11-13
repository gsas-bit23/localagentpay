import {
  OpenAPI,
  OneClickService,
  QuoteRequest,
} from "@defuse-protocol/one-click-sdk-typescript";
import type { Merchant, PayAsset, PaymentQuote } from "./types";
import { fromAtomic, toAtomic } from "./validation";

OpenAPI.BASE = "https://1click.chaindefuser.com";
if (process.env.ONECLICK_JWT) OpenAPI.TOKEN = process.env.ONECLICK_JWT;

async function bounded<T>(
  request: PromiseLike<T> & { cancel: () => void },
): Promise<T> {
  const timer = setTimeout(() => request.cancel(), 10000);
  try {
    return await request;
  } finally {
    clearTimeout(timer);
  }
}

export function createDemoQuote(
  merchant: Merchant,
  asset: PayAsset,
): PaymentQuote {
  // Fixed illustrative rates, never presented as executable market prices.
  const rates = { ETH: 2000, USDC: 1, wNEAR: 3 };
  const fee = 0.24;
  return {
    id: `demo-${crypto.randomUUID()}`,
    mode: "demo",
    merchant: merchant.name,
    merchantId: merchant.id,
    origin: {
      symbol: asset,
      chain: asset === "wNEAR" ? "NEAR" : "Ethereum",
      amount: ((merchant.price + fee) / rates[asset]).toFixed(
        asset === "ETH" ? 6 : 2,
      ),
    },
    destination: {
      symbol: "USDC",
      chain: "Base",
      amount: merchant.price.toFixed(2),
    },
    fee: `$${fee.toFixed(2)}`,
    feeLabel: "Illustrative route fee",
    expiresAt: new Date(Date.now() + 120000).toISOString(),
    estimatedSeconds: 30,
    provider: "Simulated NEAR Intents route",
    dryRun: true,
  };
}

export async function createPaymentIntent(
  merchant: Merchant,
  asset: PayAsset,
  mode: "demo" | "live",
): Promise<PaymentQuote> {
  if (mode === "demo") return createDemoQuote(merchant, asset);
  const recipient = process.env.MERCHANT_BASE_ADDRESS;
  if (
    !recipient ||
    !/^0x[0-9a-fA-F]{40}$/.test(recipient) ||
    /^0x0{40}$/i.test(recipient)
  ) {
    throw new Error(
      "Live quotes need MERCHANT_BASE_ADDRESS set to a merchant-controlled Base address in .env.local. Demo mode works without it.",
    );
  }
  try {
    const tokens = await bounded(OneClickService.getTokens());
    const origin = tokens.find(
      (t) =>
        t.symbol === asset &&
        t.blockchain === (asset === "wNEAR" ? "near" : "eth"),
    );
    const destination = tokens.find(
      (t) => t.symbol === "USDC" && t.blockchain === "base",
    );
    if (!origin || !destination)
      throw new Error("This asset route is currently unavailable from 1Click.");
    const expiresAt = new Date(Date.now() + 120000).toISOString();
    const result = await bounded(
      OneClickService.getQuote({
        dry: true,
        swapType: QuoteRequest.swapType.EXACT_OUTPUT,
        slippageTolerance: 100,
        originAsset: origin.assetId,
        destinationAsset: destination.assetId,
        amount: toAtomic(merchant.price.toFixed(2), destination.decimals),
        depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
        // INTENTS refund identifier is for dry-run schema validation only. Never fund it.
        refundTo: "localagentpay-demo.near",
        refundType: QuoteRequest.refundType.INTENTS,
        recipient,
        recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
        deadline: new Date(Date.now() + 3600000).toISOString(),
        quoteWaitingTimeMs: 3000,
      }),
    );
    if (!result.quote?.amountIn || !result.quote.amountOut)
      throw new Error("1Click returned no usable quote. Try another asset.");
    return {
      id: `preview-${crypto.randomUUID()}`,
      mode: "live",
      merchant: merchant.name,
      merchantId: merchant.id,
      origin: {
        symbol: asset,
        chain: asset === "wNEAR" ? "NEAR" : "Ethereum",
        amount: fromAtomic(result.quote.amountIn, origin.decimals),
      },
      destination: {
        symbol: "USDC",
        chain: "Base",
        amount: fromAtomic(result.quote.amountOut, destination.decimals),
        recipient,
      },
      fee: "Included in input",
      feeLabel: "Route costs + 1% input buffer",
      expiresAt,
      estimatedSeconds: result.quote.timeEstimate ?? 30,
      provider: "NEAR Intents · 1Click API",
      dryRun: true,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /unavailable|usable quote/.test(error.message)
    )
      throw error;
    throw new Error(
      "The live 1Click quote request failed. Check the JWT, route availability, and server connection, or switch to Demo. No payment was made.",
    );
  }
}
