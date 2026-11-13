"use client";
import type { WalletSelector, BrowserWallet } from "@near-wallet-selector/core";
import type { VersionedTransaction as SolanaTransaction } from "@solana/web3.js";
import type { TransactionPartialSigner } from "@solana/kit";
import type { PaymentRequired } from "@x402/core/types";
import type { PreparedCheckout, FundingQuote } from "./types";
type SolanaProvider = {
  publicKey?: { toBase58(): string };
  connect(options?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect?(): Promise<void>;
  signTransaction(
    transaction: SolanaTransaction,
  ): Promise<{ serialize(): Uint8Array }>;
  on?(event: string, callback: (key: any) => void): void;
  removeListener?(event: string, callback: (key: any) => void): void;
};
export function solanaProvider(): SolanaProvider | undefined {
  const surface = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
  };
  return surface.phantom?.solana || surface.solana || surface.solflare;
}
export async function connectSolana(trusted = false) {
  const provider = solanaProvider();
  if (!provider)
    throw new Error(
      "Install or open a Solana wallet such as Phantom or Solflare to approve travel payments. Its address also receives refunds.",
    );
  const result = await provider.connect(
    trusted ? { onlyIfTrusted: true } : undefined,
  );
  return result.publicKey.toBase58();
}
export async function signBooking(checkout: PreparedCheckout) {
  const provider = solanaProvider();
  if (
    !provider?.publicKey ||
    provider.publicKey.toBase58() !== checkout.summary.wallet
  )
    throw new Error(
      "Connect the Solana wallet shown in this booking before approving payment.",
    );
  const [
    { x402Client },
    { ExactSvmScheme },
    kit,
    { VersionedTransaction },
    { appendPaymentIdentifierToExtensions },
  ] = await Promise.all([
    import("@x402/core/client"),
    import("@x402/svm/exact/client"),
    import("@solana/kit"),
    import("@solana/web3.js"),
    import("@x402/extensions/payment-identifier"),
  ]);
  const payer = kit.address(checkout.summary.wallet);
  const signer: TransactionPartialSigner = {
    address: payer,
    signTransactions: async (transactions) =>
      Promise.all(
        transactions.map(async (transaction) => {
          if (provider.publicKey?.toBase58() !== payer)
            throw new Error(
              "Wallet account changed. Review the booking again.",
            );
          const bytes = kit.getTransactionEncoder().encode(transaction);
          const signed = await provider.signTransaction(
            VersionedTransaction.deserialize(new Uint8Array(bytes)),
          );
          const decoded = kit
            .getTransactionDecoder()
            .decode(signed.serialize());
          const signature = decoded.signatures[payer];
          if (!signature)
            throw new Error("The wallet did not sign the payment.");
          return { [payer]: signature };
        }),
      ),
  };
  const client = new x402Client()
    .setSpendControls({
      allowedAssets: [
        {
          network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          maxAmountPerPayment: checkout.summary.amountAtomic,
        },
      ],
    })
    .registerPolicy((_version, requirements) =>
      requirements.filter(
        (requirement) =>
          requirement.asset ===
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" &&
          requirement.amount === checkout.summary.amountAtomic &&
          requirement.payTo === checkout.summary.escrow,
      ),
    )
    .register(
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      new ExactSvmScheme(signer, {
        rpcUrl: `${window.location.origin}/api/checkout/rpc`,
        transactionVersions: [0],
      }),
    );
  const payload = await client.createPaymentPayload(
    checkout.requirements as unknown as PaymentRequired,
  );
  payload.extensions = appendPaymentIdentifierToExtensions(
    { ...(checkout.requirements.extensions as Record<string, unknown>) },
    checkout.paymentId,
  );
  return btoa(JSON.stringify(payload));
}
let selectorPromise: Promise<WalletSelector> | undefined;
async function selector() {
  if (!selectorPromise) {
    selectorPromise = (async () => {
      const [{ setupWalletSelector }, { setupMyNearWallet }] =
        await Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/my-near-wallet"),
        ]);
      const callback = new URL(window.location.href);
      callback.searchParams.set("checkout", "1");
      return setupWalletSelector({
        network: "mainnet",
        modules: [
          setupMyNearWallet({
            walletUrl: "https://app.mynearwallet.com",
            successUrl: callback.toString(),
            failureUrl: callback.toString(),
          }),
        ],
      });
    })().catch((error) => {
      selectorPromise = undefined;
      throw error;
    });
  }
  return selectorPromise;
}
export async function nearAccount() {
  return (
    (await selector()).store
      .getState()
      .accounts.find((account) => account.active)?.accountId || ""
  );
}
export async function connectNear() {
  const s = await selector();
  const wallet = await s.wallet<BrowserWallet>("my-near-wallet");
  await wallet.signIn({});
  return (await wallet.getAccounts())[0]?.accountId || "";
}
export async function sendNear(quote: FundingQuote, expectedAccount: string) {
  if (Date.parse(quote.expiresAt) <= Date.now())
    throw new Error(
      "This NEAR conversion quote expired. Do not send funds to it.",
    );
  const s = await selector();
  const wallet = await s.wallet<BrowserWallet>("my-near-wallet");
  const account = (await wallet.getAccounts())[0]?.accountId;
  if (account !== expectedAccount)
    throw new Error(
      "The NEAR refund account changed. Request a new conversion quote.",
    );
  const { actionCreators } = await import("@near-js/transactions");
  return wallet.signAndSendTransaction({
    signerId: account,
    receiverId: quote.depositAddress,
    actions: [actionCreators.transfer(BigInt(quote.amountIn))],
  });
}
