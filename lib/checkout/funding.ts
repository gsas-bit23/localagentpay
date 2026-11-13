import {
  OpenAPI,
  OneClickService,
  QuoteRequest,
} from "@defuse-protocol/one-click-sdk-typescript";
import { CheckoutError } from "./brij";
import { requirePayable, seal, unseal, type BookingSession } from "./session";
import { usdcBalance } from "./rpc";
import { usdcAmount } from "./types";
OpenAPI.BASE = "https://1click.chaindefuser.com";
if (process.env.ONECLICK_JWT) OpenAPI.TOKEN = process.env.ONECLICK_JWT;
async function bounded<T>(call: PromiseLike<T> & { cancel: () => void }) {
  const timer = setTimeout(() => call.cancel(), 15000);
  try {
    return await call;
  } finally {
    clearTimeout(timer);
  }
}
export async function fundWithNear(
  session: BookingSession,
  nearAccountId: string,
) {
  requirePayable(session);
  const total = BigInt(session.summary.amountAtomic),
    balance = BigInt(await usdcBalance(session.wallet));
  if (balance >= total)
    return { alreadyFunded: true, balance: usdcAmount(balance.toString()) };
  const amount = (total - balance).toString();
  const tokens = await bounded(OneClickService.getTokens());
  const near = tokens.find(
    (token) =>
      token.blockchain === "near" && token.assetId === "nep141:wrap.near",
  );
  const usdc = tokens.find(
    (token) =>
      token.blockchain === "sol" &&
      token.symbol === "USDC" &&
      token.decimals === 6,
  );
  if (!near || !usdc)
    throw new CheckoutError(
      "NEAR-to-Solana USDC is temporarily unavailable. You can still pay using existing USDC.",
      503,
      "FUNDING_UNAVAILABLE",
    );
  const deadline = Math.min(session.payBy, Date.now() + 8 * 60000);
  if (deadline < Date.now() + 60000)
    throw new CheckoutError(
      "The booking quote is too close to expiry. Refresh it before converting NEAR.",
      409,
    );
  const quote = await bounded(
    OneClickService.getQuote({
      dry: false,
      swapType: QuoteRequest.swapType.EXACT_OUTPUT,
      slippageTolerance: 100,
      originAsset: near.assetId,
      destinationAsset: usdc.assetId,
      amount,
      depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
      refundTo: nearAccountId,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      recipient: session.wallet,
      recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
      deadline: new Date(deadline).toISOString(),
      quoteWaitingTimeMs: 3000,
    }),
  );
  const q = quote.quote;
  if (
    !q?.depositAddress ||
    !q.amountIn ||
    !q.amountOut ||
    !/^\d+$/.test(q.amountIn) ||
    BigInt(q.amountOut) < BigInt(amount)
  )
    throw new CheckoutError(
      "No executable conversion quote was returned. No NEAR was sent.",
      503,
    );
  const expiresAt = new Date(
    Math.min(deadline, q.deadline ? Date.parse(q.deadline) : deadline),
  ).toISOString();
  const data = {
    intentId: session.intentId,
    depositAddress: q.depositAddress,
    amountIn: q.amountIn,
    nearAccountId,
    wallet: session.wallet,
    expiresAt,
    amount,
  };
  return {
    token: await seal("funding", data, Date.now() + 7 * 86400000),
    depositAddress: q.depositAddress,
    amountIn: q.amountIn,
    nearAmount: `${BigInt(q.amountIn) / 10n ** 24n}.${(BigInt(q.amountIn) % 10n ** 24n).toString().padStart(24, "0")}`,
    expiresAt,
    destinationAmount: usdcAmount(amount),
  };
}
export async function fundingStatus(token: string) {
  const data = await unseal<{
    depositAddress: string;
    intentId: string;
    nearAccountId: string;
    amountIn: string;
    wallet: string;
    expiresAt: string;
  }>(token, "funding");
  const status = await bounded(
    OneClickService.getExecutionStatus(data.depositAddress),
  );
  return { status: status.status, updatedAt: status.updatedAt };
}
