# LocalAgentPay

**Local living. Borderless payments.** A map-first app with in-site flight and hotel checkout, wallet payments, and optional NEAR-to-USDC conversion. Other merchants and unlisted countries are labeled **Coming soon**.

**[Open the Cloudflare app](https://localagentpay.mateen-nibtap.workers.dev)** · [Source](https://github.com/gsas-bit23/localagentpay)

![In-app hotel quote](docs/checkout-hotel.png)

## Current checkout

1. Open **Checkout**, select **Flights** or **Stays**, and search real inventory.
2. Choose an airline fare or hotel room. Hotel selection moves the map to its provider-supplied coordinates.
3. Connect a Solana wallet, enter traveller details, and review fare/property terms.
4. Request the provider's final quote. Exact USDC amount, service fee, refund wallet, expiry, and any amount due at the hotel are visible.
5. Accept the final quote and approve the exact payment in the wallet.
6. Follow order status and confirmation on this website. An encrypted recovery code restores the order; cancellation/refund requests follow the supplier's policy.

The integration uses [BRIJ's public MCP API](https://travel.brij.fi/llms.txt). Search, rate lookup, quotes, intent creation and status calls are free and rate-limited. No integration account, subscription, or API key is needed. **Travel costs, booking fees, conversion fees and network gas are not free.** The MCP flow avoids the separate paid HTTP search endpoints.

The current integration has been checked with live inventory, live unpaid quotes and executable conversion quotes. Browser signing was tested with a disposable unfunded wallet and intercepted before submission. **No funded purchase, ticket issuance, charged hotel booking, real cancellation or paid refund was performed during verification.** See [verification](docs/VERIFICATION.md).

## Wallets and NEAR

- **Existing Solana USDC:** connect an injected Solana wallet such as Phantom or Solflare and approve the booking's exact x402 payment.
- **Pay with NEAR:** connect a NEAR wallet **and** a Solana wallet. An exact-output NEAR Intents quote converts the missing amount into USDC in the user's own Solana wallet. The user approves the NEAR deposit, waits for settlement, then separately approves the booking payment.
- Booking refunds return as Solana USDC under the fare/property rules. A failed conversion uses the NEAR refund account selected from the connected NEAR wallet.
- Wallet connection never sends funds. Private keys are not requested, uploaded, or stored by this app. The merchant receives only the signed, constrained payment.

A single-NEAR-wallet checkout without a Solana wallet is **coming soon**. There is no claim that NEAR conversion alone makes every retailer purchasable.

## Availability

BRIJ provides live airline and hotel inventory; availability is checked for exact routes, dates, party size and provider eligibility. The interface currently covers 12 destination markets and a curated airport list. It supports 1–4 adults and one hotel room. Other countries and unsupported document/ancillary requirements are coming soon.

The directory's regional retailers, Travala, Newegg, Uquid, Namecheap and other unconnected providers have **Coming soon** status and no external merchant checkout button. External crypto acceptance is not treated as an integrated ordering API. Groceries, food delivery, physical shopping, mobile top-ups, domains/hosting, and local-service purchases are coming soon. Vouchers are excluded.

Read [provider research](docs/COMMERCE.md) and [checkout architecture](docs/IN_APP_CHECKOUT.md).

## Run locally

Node.js 24+ is recommended for the current wallet SDK dependencies. This workspace also completed its builds and tests on Node 22.19.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Search and map exploration need no provider key. Final quote preparation needs a private `CHECKOUT_SESSION_SECRET` so order recovery data can be encrypted. Generate a random value with at least 32 bytes, place it in `.env.local` for Next.js or `.dev.vars` for Wrangler, and keep the same value across deployments. Do not commit it. `.env.example` lists the settings. An optional `ONECLICK_JWT` can be used if the API policy requires it; the checked conversion path worked without one.

`npm ci` prepares the version-matched MapLibre worker in `public/maplibre/`; both build commands repeat that step. MapLibre + OpenFreeMap/OSM needs no Google key or Google billing. Address search uses explicit submitted Photon requests. See [map configuration and privacy](docs/MAPS.md).

## Cloudflare

The Worker is deployed at the public URL above. Secure order encryption is configured as a Worker secret; no paid provider was provisioned.

```sh
npm run build:vinext
npm run start:vinext
# After local verification:
npm run deploy:vinext -- --skip-build
```

For a new deployment, update the account and Worker name in `wrangler.jsonc`, authenticate with Wrangler, and configure `CHECKOUT_SESSION_SECRET` using `wrangler secret put`. Rotating this value without a migration makes existing encrypted recovery codes unreadable.

Next.js production scripts remain available: `npm run build` and `npm start`. Type checking regenerates Next.js route definitions so it also works after Vinext builds.

## Main files

```text
components/RouteFinder.tsx       Map panels, merchant availability, in-app entry
components/TravelCheckout.tsx    Live search, travellers, quote, wallets, order status
components/MapCanvas.tsx         Animated map, pins, GPS accuracy and responsive camera
app/api/checkout/route.ts        Validated live commerce operations
app/api/checkout/rpc/route.ts    Allowlisted read-only Solana RPC
lib/checkout/brij.ts             Fixed-origin MCP adapter and payment challenge validation
lib/checkout/payment.ts          Exact on-chain transfer and signature validation
lib/checkout/funding.ts          Executable exact-output NEAR conversion and status
lib/checkout/session.ts          Authenticated encryption of recovery and funding data
lib/checkout/wallets.ts          Browser-only Solana signer and NEAR Wallet Selector
lib/commerce/                   Directory, live/coming-soon availability and ranking
lib/maps/                       Camera presets, location and Photon normalization
```

## Checks

```sh
npm test
npm run typecheck
npm run build:vinext
```

33 tests cover payment integrity, encryption/tamper rejection, consent and input validation, atomic precision, the live SDK request boundary, map geometry, merchant routing and the separate payment sandbox. The optional GitHub workflow remains `docs/ci.yml.example`; enabling Actions needs a credential with workflow scope.

## Historical payment sandbox

`/demo` preserves the original fictional grocery/service merchants, illustrative prices, optional 1Click **dry-run** previews, and **Simulate confirmation** flow. It is separate from real BRIJ orders. Its merchant address, prices and USDC-on-Base route are never used for live travel purchases. The old `docs/demo.webm` records this simulated flow, not the current travel checkout. See [demo notes](docs/DEMO.md).
