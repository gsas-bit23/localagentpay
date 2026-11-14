# Verification

## NEAR agent payments build: November 14, 2026 (branch `near-agent`)

Everything below ran on **NEAR testnet**. No mainnet funds were used, and no mainnet contract was deployed.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Contract unit tests | Passed | `cd contracts && cargo test`: 17 escrow/policy tests + 2 token tests (caps, daily reset, expiry, revoke, allow-list, unknown/inactive merchant, wrong token, payer can't confirm, merchant/payer refund rules, deadline, overspend) |
| App tests | Passed | `npm test`: 45/45 (33 existing + 12 NEAR: unit math, relay policy abuse cases, guest-account check, request parsing, on-chain pricing, NEAR AI tool-call validation against a mock OpenAI-compatible server, NEAR AI failure fallback, 1Click dry-quote shape, signed-request tamper/expiry) |
| Typecheck and builds | Passed | `npm run typecheck`, `npm run build` (Next.js) and `npm run build:vinext` (Cloudflare Worker) all exit 0 |
| Testnet deployment | Passed | `lap.lapdemo-11140542.testnet` and `usdc.lapdemo-11140542.testnet` (see `lib/near/deployment.testnet.json`) |
| Contract e2e on testnet | Passed | `scripts/near/e2e-testnet.ts`: guest → gasless faucet+fund → policy → agent_pay → confirm → agent_pay → refund → 3 expected on-chain rejections (over per-order cap, over daily cap, after revoke) → final budget 25.3 tUSDC asserted. Links in README |
| HTTP API e2e (Next dev server) | Passed | `scripts/near/api-smoke.ts`: guest creation, relayed funding, policy, relayer refuses `ft_transfer`, agent plan, tampered signed order → 401, signed agent pay, demo confirm |
| HTTP API e2e (built Worker in local `wrangler dev`/workerd) | Passed | Same script against `dist/server` with local secrets. Orders paid and confirmed on testnet, e.g. [agent_pay](https://testnet.nearblocks.io/txns/8SM4yKKR9Aj5p1MhpmXwXEoAAtkBKsopMxShbZrLaC84), [confirm](https://testnet.nearblocks.io/txns/EVW6KMkxZUdQtfp8YUZ2nUCuq4rdf8U2AbL8gryXooxQ). `/`, `/merchant`, `/explore`, `/demo` return 200 |
| Browser flow (headless Chrome) | Passed | Try as guest → faucet+fund → authorize agent → ask "Bread and eggs" → Let agent pay → Merchant: confirm → dry quote. 0 console errors. Screenshots `agent-app.png`, `merchant-dashboard.png` |
| On-chain rejection surfaced in UI | Passed | An $18 proposal above a $10 per-order cap shows a warning; the contract rejects it, and the UI shows the error |
| 1Click funding quote | Passed (dry run) | Live mainnet API `dry: true` quotes, e.g. 25.25763 USDC on Base → 25.0 USDC on NEAR; 10.102197 USDC on Solana → 10.0 USDC on NEAR. No deposit address requested; nothing executed |
| NEAR AI Cloud inference | **Not verified live** | No `NEAR_AI_API_KEY` was available. The client, forced tool call and validation are tested against a mock server. Without a key the UI labels results "rules fallback" |
| Hosted Cloudflare Worker | **Not yet redeployed** | https://localagentpay.mateen-nibtap.workers.dev still served the previous (pre-NEAR-agent) version when this was written. Redeploy needs the owner's Cloudflare account and the Worker secrets listed in `.env.example` |
| Real merchants / real money | Out of scope | The 4 "(demo)" merchants are our own testnet accounts; tUSDC has no value |

Security notes checked: the agent key is a function-call key limited to `agent_pay` (cannot attach deposits), and its allowance is 2 NEAR for gas. The demo-merchant key is limited to `confirm`/`refund`/`set_merchant_active`. The relayer sponsors only `g-*.lapdemo-11140542.testnet` senders calling allow-listed methods on the two contracts, with ≤1 yocto deposit and ≤150 Tgas. Guest creation is rate-limited per Worker isolate (3 per 10 minutes per IP).

## Earlier verification (pre-hackathon map/travel/sandbox work)

Verified November 13, 2026 against the local production build.

| Boundary | Result | Evidence |
| --- | --- | --- |
| App build | Passed | Next.js production build and TypeScript check exit 0 |
| Core checks | Passed | 7 tests: atomic precision, budget filtering, validation, demo quote, missing live config, rules assistant, mocked live SDK request |
| Chat → API → choices | Passed | Browser grocery request renders 3 fictional merchants; car API request under $100 returns 2 options |
| Selection → quote → UI | Passed | Green Basket shows 0.024120 demo ETH on Ethereum → 48.00 USDC on Base |
| Confirmation | Passed | Browser displays simulated receipt and “No funds moved. No order was placed.” |
| Quote invalidation | Passed | Changing asset clears previous quote and receipt |
| Quote expiry | Passed | Advancing browser time by 121 seconds exposes Refresh quote |
| Input and errors | Passed | Invalid chat 400, unknown merchant 404, missing live recipient 422; browser renders error |
| City and budget | Passed | Typed city accepted; groceries under $10 renders empty state |
| Location permission denied | Passed | Browser displays denial message and typed-city form remains available |
| Mobile | Passed | 390px viewport: document width does not exceed viewport; stacked merchant cards |
| Production browser console | Passed for demo flow | Zero console messages after initial load, discovery, quote, and receipt |
| NEAR token catalog | Reachable | GET /v0/tokens returns ETH/USDC on Ethereum, USDC on Base, wNEAR on NEAR |
| Real 1Click quote | Not verified | No merchant-controlled address or JWT configured; live wrapper tested using SDK mocks |
| NEAR AI inference | Not verified | No NEAR AI credentials/model configured; deterministic fallback verified |
| On-chain transfer/merchant order | Outside prototype | No signing, funding, fulfillment, or settlement implemented |

Media: `workspace.png`, `payment-preview.png`, `confirmation.png`, and `demo.webm` show the actual demo-mode production build. The recording is silent. API-error testing produces an expected browser network error for the deliberate HTTP 422 response.

Publication: the source is public at https://github.com/gsas-bit23/localagentpay. The current GitHub credential lacks `workflow` scope, so CI is provided as `ci.yml.example` rather than enabled. The X post is prepared but not published, and no hackathon submission has been made.

## Cloudflare deployment

Live URL: **https://localagentpay.mateen-nibtap.workers.dev**

- Initial Worker: `localagentpay`; initial version: `d89baa60-d9a9-429b-94e9-6a3b3c82f8cc`.
- Built with Vinext and Cloudflare's Vite plugin; deployed with Wrangler using the existing authenticated account.
- Seven tests, TypeScript, and the Vinext production build passed. Original Next.js scripts remain available.
- The original Next.js production build also passed after migration. Type checking regenerates route definitions to avoid stale generated types when switching between Next.js and Vinext.
- The built local Worker passed the full browser flow with zero console errors or warnings.
- The public URL returned HTTP 200. The deployed chat API returned 3 grocery choices; its quote API returned 0.024120 demo ETH on Ethereum → 48.00 USDC on Base.
- The public browser completed chat → merchant selection → quote → simulated confirmation with zero console errors or warnings. Screenshot: `cloudflare-live.png`.
- No API secrets were provisioned. The hosted app uses the same rules assistant, fictional fixtures, illustrative quotes, and simulated confirmation as the no-key local demo.

The earlier Vercel deployment attempt was blocked by that team's fair-use restriction. The Cloudflare deployment succeeded independently.

## Merchant route finder update — November 14, 2026

- Home page: real-provider recommendations across 12 countries, 7 categories, and 37 provider entries. The original fictional payment flow moved to `/demo`.
- `POST /api/routes` filters countries/categories, handles budget currency context, ranks named merchants and documented payment options, and returns sources and provider handoffs. `GET /api/routes` lists infrastructure references.
- All 18 tests passed. Tests cover country isolation, missing/conflicting countries, crypto-only filtering, direct NEAR vs conversion paths, merchant restrictions, flight vs hotel product fit, account funding, unknown prices, voucher exclusion, and the original SDK/sandbox boundaries.
- TypeScript and the Cloudflare/Vinext production build passed.
- Local Worker browser flow passed for Pakistan groceries, UAE hotel/NEAR, US Newegg crypto shopping, empty crypto routes, and UK Tesco selection. Browser console: 0 errors, 0 warnings.
- At 390px width, route selection scrolls to details and the page has no horizontal overflow.
- The `/demo` chat → fictional merchant → quote → simulated confirmation flow still passes.
- A real provider ID (`travala`) sent to `/api/quote` returns 404, preventing use of fictional prices or the sandbox recipient for a real purchase.
- New media: `route-finder.png`, `route-shopping.png`, `route-mobile.png`.
- Provider checkout APIs, live cart prices, automatic purchasing, funded invoices, and wallet transactions are not connected to the finder. Recommendations are not live lowest-price quotes. Conditional international listings require product/destination eligibility checks.

The official sources and limitations are documented in `COMMERCE.md`. No real purchase was performed during verification.

Deployed update: version `da506bc0-8dad-4b49-a1fe-e7b60ad9c223` at the same public Cloudflare URL. The public homepage and `/demo` return HTTP 200. Public routing API checks passed for Pakistan groceries, US crypto shopping, UAE hotel/NEAR, the empty crypto-only grocery case, and UK domain registration. The public browser rendered Newegg's regional handoff and Travala's direct NEAR option with zero console errors or warnings. Screenshot: `route-live.png`.

## Map workspace update — November 14, 2026

- MapLibre GL JS 6.18.0 + OpenFreeMap/OSM background with persistent map instance, floating merchant/payment panels, and mobile bottom panel. No Google key or billing required.
- All 25 tests pass, including coordinate order/precision, country camera bounds, city-center labeling, Photon normalization/filtering/deduplication, invalid searches, and closed GPS accuracy geometry. TypeScript and production build checks pass.
- Browser country selection moves to Pakistan (zoom 5.20, center 69.355 / 30.599), and a Dubai hotel request focuses Dubai at city zoom and opens Travala's direct NEAR steps. Only one map canvas remains mounted.
- Actual submitted Photon searches return real map listings. Local Mazar-e-Quaid search returns six listings; explicit Tesco/London store discovery returns six actual listings. Provider recommendations remain separate from physical listings.
- Device geolocation tested with mocked public city points and ±35 m / ±80 m reported accuracy. Marker, accuracy text, and the uncertainty circle render. Desktop-to-mobile resizing keeps the point visible. A mocked permission-denied callback displays the recovery message; manual coordinates remain usable. No user's GPS was recorded.
- Mobile 390×844: panel expansion/collapse and manual-coordinate fallback pass; document width is 390px. Attribution stays above the panel. Camera padding adapts to viewport changes.
- Public deployment browser passes map load → Dubai request → Travala details → correct provider handoff. Zoom, recenter, and Light layer switch pass. Zero console errors. The upstream map style emits nonfatal road-shield filter warnings for missing numeric tile fields.
- Public `/api/map/search` returns HTTP 200 with six normalized Pakistan listings; an invalid short query returns 400. `/demo` still returns 200.
- New screenshots: `map-workspace.png`, `map-mobile.png`, `map-gps.png`, `map-live.png`. See `MAPS.md` for service limits, attribution, location privacy, worker preparation, and future provider replacement.

Checkout execution and payments remain unchanged: provider handoffs and the separate simulated payment sandbox. No funds or real orders were submitted.

Final map deployment: Cloudflare Worker version `08170b48-3cf4-4729-aa72-9aa0297157df`, at the same public URL. Final local checks also cover camera padding after viewport changes and GPS accuracy geometry after tile loading.
