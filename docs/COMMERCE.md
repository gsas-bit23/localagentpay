# Merchant integration research

Reviewed November 14, 2026. The website now prioritizes in-app checkout. A store accepting cryptocurrency on its own website is not evidence that our app can place its orders.

| Provider | Evidence | Cost/access finding | Status in this app |
| --- | --- | --- | --- |
| BRIJ Travel | [Official manifest](https://travel.brij.fi/llms.txt), [API](https://travel.brij.fi/openapi.json), [travel docs](https://docs.brij.fi/) | Public MCP, no account/key/subscription. Search, rates, quotes, intent/status and refund-call fees waived over MCP; rate limits apply. Actual booking pays the exact escrow including provider fees. | Integrated: flight/hotel inventory, in-app quote, wallet signing/submission, tracking and cancellation requests. Funded fulfillment remains untested. |
| Crossmint | [Pricing](https://www.crossmint.com/pricing), [production access](https://help.crossmint.com/articles/2804023362-how-do-i-get-production-access-to-crossmint) | Pricing lists 1,000 free Agent Checkouts monthly, but official production access still requires an enterprise agreement and KYB. Free staging is not unrestricted free production access. | Coming soon; no production agreement/key was provisioned. |
| Uquid | [B2B API](https://uquid.com/shop/api), [public API spec](https://shop.uquid.com/public/api/openapi) | Approved business partners, KYB, API key/HMAC secret and prefunded partner balance. Unrestricted free production access was not established. | Coming soon. No fabricated catalog/order adapter enabled. |
| Purch | [Solana Foundation catalog](https://pay.sh/services/purch/marketplace) | Catalog lists free search. Direct probe of its documented `https://api.purch.xyz/x402/search` returned HTTP 404 during this review. | Coming soon; catalog claims alone did not qualify it as usable. |
| Credpay | [Product](https://shop.credpay.ai/) | Product describes USDC/Base and autonomous shopping, but its linked docs could not be accessed reliably during review. Free usable production checkout could not be verified. | Coming soon. |
| Travala, Newegg, Namecheap, regional retailers | Existing provider directory and payment evidence | Their external checkout/payment support does not grant anonymous catalog/order/fulfillment access to this app. No usable free ordering authorization was established here. | Coming soon; external merchant checkout buttons removed. |

No gift-card/voucher workaround was enabled. No provider account was opened, paid plan purchased, sales message sent, or real booking paid for during this work. The connected Paybox discovery tool required reauthentication; public provider sources were used instead.

## What is integrated

BRIJ's public MCP returned live American Airlines and other flight offers on a sample SFO–JFK search, and real hotel inventory around Dubai. Hotel names, room rates, cancellation terms, coordinates and extra amounts due at the hotel come from the provider. Prices are refreshed for the final booking intent, whose challenge determines the exact token amount and escrow.

Provider integration access is free; the trip is not. Hotel fees and cancellation deductions, amounts due at the property, card/security-deposit requirements, airline restrictions and conversion costs must be reviewed before approval. No inventory is silently replaced with fictional data when a provider fails.

## Markets and planned merchants

The UI exposes 12 destination markets: Pakistan, India, US, UK, UAE, Germany, Singapore, Nigeria, Canada, Australia, France and Japan. Flight destinations use an explicit airport list; hotel city country is checked against the selected market. Bookability remains provider- and date-specific. Unlisted countries are explicitly coming soon; global provider marketing is not treated as verified coverage for every user or product.

The existing 37 directory entries remain planned merchants. BRIJ adds one connected travel provider (38 entries in total). All unconnected merchants and non-travel purchase categories have Coming soon status and no merchant-site checkout handoff. `/api/routes` does not fabricate live quotes; the separate checkout API retrieves actual inventory and final prices.
