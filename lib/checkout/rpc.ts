import { PublicKey } from "@solana/web3.js";
import { CheckoutError } from "./brij";
import { USDC_MINT } from "./types";
const rpcUrls = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];
const allowed = new Set([
  "getAccountInfo",
  "getLatestBlockhash",
  "getBlockHeight",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getBalance",
  "getSignatureStatuses",
]);
export async function solanaRead(method: string, params: unknown[]) {
  if (!allowed.has(method))
    throw new CheckoutError("Only Solana account reads are supported.", 400);
  for (const url of rpcUrls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(9000),
        cache: "no-store",
      });
      if (!r.ok) continue;
      const data = await r.json();
      if (!data.error) return data.result;
    } catch {
      /* Try the other public read endpoint. */
    }
  }
  throw new CheckoutError(
    "The Solana network reader is temporarily unavailable. No payment has been sent by this request.",
    503,
    "RPC_UNAVAILABLE",
  );
}
export async function usdcBalance(wallet: string) {
  const tokenProgram = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  );
  const [account] = await PublicKey.findProgramAddress(
    [
      new PublicKey(wallet).toBytes(),
      tokenProgram.toBytes(),
      new PublicKey(USDC_MINT).toBytes(),
    ],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
  const result = await solanaRead("getAccountInfo", [
    account.toBase58(),
    { encoding: "base64", commitment: "confirmed" },
  ]);
  if (result?.value === null) return "0";
  const value = result?.value;
  if (
    value?.owner !== tokenProgram.toBase58() ||
    !Array.isArray(value?.data) ||
    value.data[1] !== "base64"
  )
    throw new CheckoutError(
      "The wallet's spendable USDC account could not be verified.",
      503,
    );
  const data = Buffer.from(value.data[0], "base64");
  if (
    data.length < 165 ||
    new PublicKey(data.subarray(0, 32)).toBase58() !== USDC_MINT ||
    new PublicKey(data.subarray(32, 64)).toBase58() !== wallet
  )
    throw new CheckoutError(
      "The USDC account does not match your wallet.",
      503,
    );
  return data.readBigUInt64LE(64).toString();
}
