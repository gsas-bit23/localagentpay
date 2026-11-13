# LocalAgentPay demo and submission notes

## Current in-app travel checkout

The home page now includes live BRIJ flight/hotel search, final quotes, wallet connection, optional NEAR conversion, payment submission, order status and refund/cancellation requests. Other merchants and unlisted countries are Coming soon, with no external merchant checkout buttons.

A current demonstration should search flights or hotels, select inventory, show final fees/property terms and an unfunded-wallet block. Do not imply a paid booking was verified. If showing browser signing with a disposable wallet, intercept submission and label it as a test. The NEAR flow currently requires a NEAR wallet plus a Solana wallet for settlement/refunds. See [IN_APP_CHECKOUT.md](IN_APP_CHECKOUT.md).

The older `demo.webm` and script below show the separate `/demo` sandbox with fictional merchants and simulated confirmation. They are historical and do not show the real travel checkout. No new social post or hackathon submission was published.

## 60–90 second recording

1. **0–10 sec:** Show the landing workspace. Say: “LocalAgentPay connects a simple local errand with a cross-chain payment preview.”
2. **10–20 sec:** Enter your city. Point out that the local listings, distances, and trust values are fictional demo data. No GPS permission is required.
3. **20–35 sec:** Ask “Find weekly groceries near me under $60.” Show three sample choices with prices and sample trust scores.
4. **35–50 sec:** Select Green Basket. Explain the route: pay ETH on Ethereum; the merchant's target output is 48 USDC on Base. Show the fee, expiry, and explicit demo label.
5. **50–65 sec:** If live credentials are configured, select Live API preview and request the dry-run quote. Show the real SDK wrapper briefly: token discovery, exact-output quote, `dry: true`, integer atomic amounts. If not configured, describe the integration as implemented but not live-verified; do not present the demo amount as an API result.
6. **65–80 sec:** Click Simulate confirmation. Show “No funds moved. No order was placed.” Say: “The prototype demonstrates discovery and payment routing. Wallet funding and merchant fulfillment are future work.”
7. **80–90 sec:** Show the public repository and setup instructions. Mention NEAR Intents and the Agent Economy / Real-World Money tracks.

Capture at 1440×1100 or 1440×900. Keep the mode label visible. Never record environment values or access tokens.

## X post draft

LocalAgentPay finds merchants by country and explains NEAR, crypto, or conventional checkout routes.

12 countries. Direct purchases, no voucher suggestions. Separate payment sandbox.

Demo: https://localagentpay.mateen-nibtap.workers.dev

@NEARProtocol #NEARHackathon

Attach your recorded demo, check the final character count. This draft has not been posted.

Source repository for the submission form: https://github.com/gsas-bit23/localagentpay

## Submission checklist

- [ ] Confirm current organizer deadline, eligibility, and track requirements.
- [ ] Open the public GitHub repository in a signed-out browser.
- [ ] Confirm a fresh `npm ci` → `npm run dev` works.
- [ ] If using live preview, configure a merchant-controlled recipient and obtain a JWT if needed.
- [ ] Record the flow, keeping demo/live labels visible.
- [ ] Publish the public demo post with @NEARProtocol and #NEARHackathon.
- [ ] Add the repository, demo post, video, and hosted demo URL (if any) to the organizer's submission form.
- [ ] Submit and save the organizer's confirmation.

Public source, a published demo post, and an accepted hackathon submission are separate steps. A working local build alone does not satisfy all submission requirements.
