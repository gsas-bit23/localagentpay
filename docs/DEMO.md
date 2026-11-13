# LocalAgentPay demo and submission notes

## Current map workspace

Start by selecting Pakistan and then Japan to show the animated map. Search `24.8546842, 67.0207055` for coordinate precision, or use device location and explain the reported uncertainty. On mobile, expand/collapse the floating bottom panel. Continue with merchant routing below. Map listings and online provider coverage are distinct.

## Current merchant route finder

The home page now recommends real provider handoffs across 12 countries and seven categories; it does not execute their checkout APIs. The original payment sandbox remains at `/demo`.

Suggested current recording:

1. Ask **Weekly groceries in Karachi under PKR 5000**. Show foodpanda / pandamart and its explicit “NEAR not connected” status. The budget is context, not a claim about live cart pricing.
2. Ask **Book a hotel in Dubai and pay in NEAR**. Show Travala, the public payment source, and the direct NEAR invoice steps.
3. Ask **Buy headphones in the US using crypto**. Show Newegg US and Uquid. Highlight Newegg's eligible-item and desktop-checkout restrictions.
4. Choose **Crypto options only**, then ask for groceries in Pakistan. Show the empty state instead of a fabricated route.
5. Ask for flights or domain registration. Show Alternative Airlines or Namecheap's distinct account-funding flow.
6. Open `/demo` separately if demonstrating the SDK quote and simulated receipt. Do not present a sandbox quote as a real provider invoice.

The previous silent `demo.webm` below records the original sandbox; it does not represent the new merchant route finder.

The repository includes `demo.webm`, a silent screen recording of the production build's demo-mode flow, and three screenshots. It shows fictional merchant discovery, the ETH → USDC/Base preview, and simulated confirmation. It does not show a live provider quote. Add narration or record the script below for a polished submission.

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
