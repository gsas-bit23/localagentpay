# Country-aware commerce routing

The home page now answers **where can I buy this, and what payment path is documented?** It uses real storefronts and public evidence. The original fictional payment example lives at `/demo`.

## What works

- `POST /api/routes` parses a category and budget, identifies a supported country or asks for clarification, and ranks up to five compatible provider entries.
- Twelve countries, seven purchase categories, and 37 provider entries. One entry can represent multiple countries or categories.
- Named merchant matches are prioritized within the matching country and category. Then documented direct NEAR checkout, other crypto checkout, and regional storefronts are favored. Equal scores are ordered by provider name for deterministic results; the ordering is not a price comparison.
- The crypto-only filter excludes conventional checkout and unknown payment routes.
- Each result has reasons, a payment label, proposed steps, official source links, a provider handoff, and explicit caveats.
- No voucher-specific providers are suggested. Uquid users are directed to the relevant physical-product or direct top-up offering, not to purchase a gift card.
- Budget values preserve a supplied currency; without a symbol/code the country's currency is used. Budgets cannot filter provider offers because live cart prices are not queried.

## Regional examples

| Country        | Grocery / food examples      | Shopping examples    |
| -------------- | ---------------------------- | -------------------- |
| Pakistan       | foodpanda / pandamart        | Daraz Pakistan       |
| India          | Blinkit, Swiggy              | Amazon India         |
| United States  | Instacart, Walmart, DoorDash | Amazon US, Walmart   |
| United Kingdom | Tesco, Deliveroo             | Amazon UK            |
| UAE            | talabat                      | noon UAE, Amazon UAE |
| Germany        | REWE, Lieferando             | Amazon Germany       |
| Singapore      | FairPrice, GrabFood          | Shopee Singapore     |
| Nigeria        | Chowdeck                     | Jumia Nigeria        |
| Canada         | Instacart, Uber Eats         | Amazon Canada        |
| Australia      | Woolworths, Uber Eats        | Amazon Australia     |
| France         | Carrefour, Uber Eats         | Amazon France        |
| Japan          | Uber Eats                    | Amazon Japan         |

Travel can suggest Travala or Alternative Airlines for flights; hotel requests exclude the flight-only provider. Shopping can suggest Newegg US/Canada where eligible, and Uquid. Mobile top-ups can suggest Uquid. Domains and hosting can suggest Namecheap's crypto-funded account flow. International catalogs are marked conditional: every product, destination, operator, booking, and invoice still needs confirmation. Local services use a Google Maps discovery link and do not invent businesses, ratings, or payment acceptance.

## Payment distinctions

**Travala:** Its public payment-options page lists NEAR. The suggested path is select a booking → confirm NEAR and the exact network on its invoice → approve with a wallet → receive provider confirmation. No bridge is inserted merely to make the route appear cross-chain. A token on a payment-methods page does not prove it is available for every booking.

**Uquid:** The provider advertises crypto shopping and mobile top-ups. A candidate path is select an eligible direct product → obtain the real invoice → evaluate an exact-output NEAR Intents route to its accepted token/network → pay through the supported flow → confirm fulfillment. This is not a live quote or proof that a particular invoice accepts bridge-originated payments. Refund handling, timing, and third-party deposit acceptance need to be checked before funding.

**Newegg:** Regional US and Canadian entries document BitPay checkout for eligible orders. Marketplace items, subscriptions, pre-orders, gift cards, and mobile-app checkout are excluded. Known restricted product requests omit this crypto route. A price or product listing from a third-party seller is not assumed eligible.

**Alternative Airlines:** Flight booking supports crypto through the payment providers offered at checkout. It is a booking intermediary; the underlying airline is not labeled as accepting NEAR. No hotel route is inferred from flight support.

**Namecheap:** Crypto is used to fund the customer's own account, after which the account balance pays for domains or hosting. The proposed route explicitly includes waiting for credit and then making the purchase. It does not imply instant domain registration or a direct NEAR payment method.

**Regional conventional stores:** Links are real, but this application has no connected NEAR-funded checkout for them. Crypto conversion alone cannot pay a conventional card checkout. A compatible off-ramp, card, or checkout-execution integration is a separate requirement. The app does not assert that any named store universally refuses crypto; it reports the capabilities connected here.

## Implemented boundaries

The registry and ranking are implemented. Provider inventory/pricing APIs, cart creation, authenticated commerce APIs, payment invoices, wallet connection, conversion execution, and real order fulfillment are not integrated into this finder. All handoff buttons open the provider's website for the user to finish there. The payment sandbox's merchant address and sample amount are never applied to a real provider.

`GET /api/routes` lists infrastructure references. Crossmint Agent Checkout is a potential execution partner; access, merchant compatibility, payment funding, and destination coverage need confirmation. Instacart's developer platform supports shopping-list integrations with API credentials. foodpanda's Partner API is for vendor catalog and order management, not a public consumer purchasing API. None is represented as connected.

## Public evidence reviewed November 14, 2026

- [NEAR Intents](https://intents.near.org/): cross-chain liquidity and execution.
- [Travala payment options](https://www.travala.com/payment-options): lists NEAR and other crypto methods.
- [Newegg US payment policy](https://kb.newegg.com/knowledge-base/accepted-payment-methods) and [Canadian policy](https://kb.newegg.ca/knowledge-base/accepted-payment-methods): BitPay scope and product restrictions.
- [Alternative Airlines crypto checkout](https://www.alternativeairlines.com/cryptocurrencies): flight booking with supported crypto providers.
- [Namecheap crypto payments](https://www.namecheap.com/support/payment/bitcoin/): account funding for domains and hosting.
- [Uquid token list](https://shop.uquid.com/token): supported crypto methods and mobile top-ups.
- [Uquid delivery policy](https://shop.uquid.com/shop/page/delivery-policy): physical and digital delivery distinctions.
- [foodpanda Pakistan groceries](https://www.foodpanda.pk/groceries): regional grocery storefront.
- [Blinkit](https://blinkit.com/): India grocery storefront.
- [talabat UAE](https://www.talabat.com/uae): UAE food/grocery storefront.
- [FairPrice](https://www.fairprice.com.sg/): Singapore grocery storefront.
- [Tesco groceries](https://www.tesco.com/groceries/): UK grocery storefront.
- [Crossmint Agent Checkout](https://www.crossmint.com/products/agentic-checkout): checkout execution infrastructure to evaluate.
- [Instacart Developer Platform](https://docs.instacart.com/developer_platform_api/): shopping integrations requiring access.
- [foodpanda Partner API](https://developer.foodpanda.com/api-specifications): vendor-side API scope and credential requirements.

Each registry entry also retains its own official storefront URL. A directory review is not a live inventory, eligibility, reputation, or lowest-price check. Recheck payment documentation and checkout capabilities before enabling actual funding.

## Map context

The map workspace synchronizes country/city selection with its camera. Merchant cards represent provider coverage, not branch addresses. Explicit physical-store discovery uses actual OpenStreetMap listings and does not imply verified payment acceptance. See [MAPS.md](MAPS.md).

## Map context

The map workspace synchronizes country/city selection with its camera. Merchant cards represent provider coverage, not branch addresses. Explicit physical-store discovery uses actual OpenStreetMap listings and does not imply verified payment acceptance. See [MAPS.md](MAPS.md).
