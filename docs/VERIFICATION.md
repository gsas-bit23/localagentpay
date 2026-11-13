# Prototype verification

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
