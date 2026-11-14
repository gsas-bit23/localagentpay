import deployment from "./deployment.testnet.json";

/** Public, non-secret NEAR configuration. Testnet only in this prototype. */
export const near = {
  network: "testnet" as const,
  rpcUrl: deployment.rpcUrl,
  explorer: deployment.explorer,
  root: deployment.root,
  lap: deployment.lapContract,
  token: deployment.tokenContract,
  tokenSymbol: deployment.tokenSymbol,
  tokenDecimals: deployment.tokenDecimals,
  agent: deployment.agentAccount,
  relayer: deployment.relayerAccount,
  demoMerchants: deployment.demoMerchants as string[],
};

export const txUrl = (hash: string) => `${near.explorer}/txns/${hash}`;
export const accountUrl = (id: string) => `${near.explorer}/address/${id}`;

/** Token base units (6 decimals) <-> display strings, without floating point drift. */
export function toUnits(amount: string | number): string {
  const text = typeof amount === "number" ? amount.toFixed(6) : amount.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error("Use a positive amount with at most 6 decimals");
  const [whole, frac = ""] = text.split(".");
  return (BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"))).toString();
}
export function fromUnits(units: string | bigint): string {
  const v = BigInt(units);
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${v / 1_000_000n}${frac ? "." + frac : ""}`;
}

/** Guest accounts are named sub-accounts of the relayer root, e.g. g-k3x9.lapdemo.testnet. */
export function isGuestAccount(id: string) {
  return /^g-[a-z0-9]{4,20}\./.test(id) && id.endsWith(`.${near.root}`);
}
