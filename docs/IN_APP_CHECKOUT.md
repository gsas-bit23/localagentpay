# In-app checkout

The map workspace integrates BRIJ flight and hotel ordering over its public MCP endpoint, fixed to `https://travel.brij.fi/mcp`. It does not proxy arbitrary MCP tools, arbitrary destinations, or private credentials. The only non-travel commerce shown as actionable is none: unconnected merchants are Coming soon.

## Request flow

`POST /api/checkout` validates a discriminated action schema. Actions cover flights, flight search updates, hotels, room rates, final preparation, order recovery/status, balance, NEAR conversion/status, payment execution, and explicit cancellation/refund requests. Search is free over MCP; the paid HTTP search endpoints are not used. Provider errors and missing inventory remain errors/empty results, not demo prices.

Preparation refreshes the selected fare or room quote, validates traveller count and terms consent, creates an unpaid provider intent, and obtains its x402 challenge. It checks mainnet Solana, the exact USDC mint, exact atomic amount, fixed booking endpoint, provider escrow, fee payer, and the user's funding/refund wallet. It returns a ten-minute-or-shorter quote, fresh final terms, encrypted recovery token, and stable payment identifier. Customer support codes and traveller/contact fields are authenticated-encrypted, not placed in public URLs.

The browser requests a final terms approval and wallet signature only after review. The official x402 client has an atomic spend cap equal to that booking, plus a policy restricting token, amount and escrow. The backend independently deserializes the signed v0 transaction, verifies the buyer's Ed25519 signature, permits only compute-budget/memo instructions and one exact USDC TransferChecked, and checks the source/destination associated token accounts and fee payer. An altered amount, extra transfer, different asset/network/escrow or signer is rejected before provider submission.

Only the provider/facilitator completes and broadcasts the x402 transaction. This server has no user signing key. A saved approved payload is retried byte-for-byte with the same payment identifier; errors do not automatically create or sign a replacement. The current provider intent is checked before execution. A booking reference/status is the confirmation authority, not a local spinner or receipt animation.

## NEAR funding

The supported route currently needs two wallets:

1. A connected NEAR wallet for native NEAR deposit and failed-swap refunds.
2. A connected Solana wallet for x402 booking approval and travel refunds.

The server reads spendable USDC from the user's associated token account, using basic public RPC reads. It quotes only the shortfall via the official 1Click SDK with `dry:false`, `EXACT_OUTPUT`, catalog-discovered `nep141:wrap.near` and Solana USDC, and the connected wallets as recipient/refund addresses. Managed 1Click handles native NEAR wrapping ([official documentation](https://docs.agentsonintents.com/integration/verifier-contract/deposits-and-withdrawals/near-token)). The input includes the quoted conversion route/slippage; NEAR wallet transaction gas is separate.

The user separately approves the NEAR transfer through My NEAR Wallet, waits for conversion status/USDC balance, and then approves booking. Converting funds does not itself place a booking. User USDC remains in their own wallet if the booking is not approved. Single-wallet NEAR chain-signature checkout is not implemented and is coming soon.

## Order recovery, cancellation and privacy

`CHECKOUT_SESSION_SECRET` is a server-only random secret used to derive an AES-GCM key. Recovery records carry an independent random IV, authenticated version/context, expiry, supplier support code, frozen order body, payment requirements and final terms. Invalid tags, wrong token purpose and expired tokens fail closed. Quote payment expiry is separate from the longer recovery period. A recovery code is private bearer access to the order and its cancellation workflow; keep it private.

Only encrypted order records and public payment/conversion metadata are persisted by the app in browser storage; private wallet keys are never handled. The already-approved payment payload can be kept for exact retries; it is scoped to the original escrow, amount and short-lived blockhash. Traveller/contact details are sent to BRIJ and its suppliers for fulfillment, not to the map/geocoder or an LLM. Review the provider's [privacy policy](https://docs.brij.fi/privacy) and fare/property rules.

The app can recover/check an intent, show provider confirmation, submit a flight refund request, and submit a hotel cancellation request. Names/support authorization are supplied only to the provider. Fare restrictions, hotel cancellation timelines, retained service fees and extra charges govern eligibility and amount. A failed booking's escrow mechanism is not a blanket promise that every voluntarily cancelled confirmed booking is fully refundable.

This prototype stores one active recovery record in the browser. Before starting a new search after preparation/payment, the UI directs the user to keep the previous recovery code. Rotating the server secret invalidates old records unless migrated. Recovery/status is available without reconnecting a wallet; a new payment still requires the originally selected wallet's signature.

## Configuration

No merchant API key or subscription is required for the BRIJ MCP integration. Set a private random `CHECKOUT_SESSION_SECRET` (at least 32 random bytes) in `.env.local` for Next.js or `.dev.vars` for local Wrangler, and as a Worker secret in production. Keep it unchanged across deployments. Optional `ONECLICK_JWT` is server-only; the verified native-NEAR quote worked without it. No app fee was inserted.

Basic Solana RPC reads use public endpoints with fallback. Account balance reads use the canonical USDC associated account, avoiding indexed account searches that now require a personal PublicNode token. The RPC proxy allowlists read methods and cannot broadcast transactions.

Current limits: 1–4 adults, one hotel room, listed destination countries/airports, maximum 100,000 USDC per checkout, no identity-document-required fares, no seat-map/ancillary purchase, no gift cards. Additional coverage is Coming soon. Public service rate limits and provider eligibility still apply.

## Verification boundary

Live inventory, real unpaid intents, real payment challenges, native NEAR executable conversion quotes, and actual browser transaction signing were checked. Test wallets were unfunded. Browser payment submission was deliberately intercepted; no funds moved, airline ticket was issued, paid reservation was made, or real refund/cancellation executed. Payment submission, supplier fulfillment and paid refunds remain unverified with real money. Unit checks cover the signed transfer and SDK boundaries without funding a purchase.
