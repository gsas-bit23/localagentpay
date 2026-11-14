/** NEAR Intents 1Click: "pay in with any asset" previews. Always dry: no deposit address, no funds move. */
export const NEAR_USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

export const FUNDING_ORIGINS = {
  "near-wnear": { label: "NEAR (wNEAR) on NEAR", asset: "nep141:wrap.near", chain: "near", decimals: 24, symbol: "NEAR" },
  "base-usdc": { label: "USDC on Base", asset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", chain: "evm", decimals: 6, symbol: "USDC" },
  "arb-usdc": { label: "USDC on Arbitrum", asset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", chain: "evm", decimals: 6, symbol: "USDC" },
  "eth-eth": { label: "ETH on Ethereum", asset: "nep141:eth.omft.near", chain: "evm", decimals: 18, symbol: "ETH" },
  "sol-usdc": { label: "USDC on Solana", asset: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", chain: "sol", decimals: 6, symbol: "USDC" },
} as const;
export type FundingOrigin = keyof typeof FUNDING_ORIGINS;

// Placeholder refund addresses are only used for dry previews (dry: true never executes).
const PREVIEW_REFUND = { evm: "0x52908400098527886E0F7030069857D2E4169EE7", sol: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" };

export function buildDryQuote(origin: FundingOrigin, amountUnits: string, recipient: string, now = Date.now()) {
  const o = FUNDING_ORIGINS[origin];
  return {
    dry: true,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: o.asset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: NEAR_USDC,
    amount: amountUnits,
    refundTo: o.chain === "near" ? recipient : PREVIEW_REFUND[o.chain],
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(now + 10 * 60_000).toISOString(),
  };
}

export async function dryQuote(origin: FundingOrigin, amountUnits: string, recipient: string) {
  const body = buildDryQuote(origin, amountUnits, recipient);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  const response = await fetch("https://1click.chaindefuser.com/v0/quote", { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.quote) throw new Error(json.message || `1Click returned ${response.status}`);
  const q = json.quote;
  return {
    origin: FUNDING_ORIGINS[origin].label,
    pay: `${q.amountInFormatted} ${FUNDING_ORIGINS[origin].symbol}`,
    payUsd: q.amountInUsd,
    receive: `${q.amountOutFormatted} USDC on NEAR`,
    timeEstimateSec: q.timeEstimate,
    recipient,
    dry: true,
    correlationId: json.correlationId,
    signature: json.signature,
  };
}
