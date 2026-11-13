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
| Mobile | Passed | 390px viewport: document width does not exceed viewport; stacked merchant cards |
| Production browser console | Passed for demo flow | Zero console messages after initial load, discovery, quote, and receipt |
| NEAR token catalog | Reachable | GET /v0/tokens returns ETH/USDC on Ethereum, USDC on Base, wNEAR on NEAR |
| Real 1Click quote | Not verified | No merchant-controlled address or JWT configured; live wrapper tested using SDK mocks |
| NEAR AI inference | Not verified | No NEAR AI credentials/model configured; deterministic fallback verified |
| On-chain transfer/merchant order | Outside prototype | No signing, funding, fulfillment, or settlement implemented |

Media: `workspace.png`, `payment-preview.png`, `confirmation.png`, and `demo.webm` show the actual demo-mode production build. The recording is silent. API-error testing produces an expected browser network error for the deliberate HTTP 422 response.
