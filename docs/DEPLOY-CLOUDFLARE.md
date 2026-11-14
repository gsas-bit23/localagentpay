# Redeploying the hosted Worker (owner only)

Run these commands from the repo root on the `near-agent` branch while logged in to the Cloudflare account in `wrangler.jsonc`. The values come from the private `.dev.vars` written by `scripts/near/deploy-testnet.mjs`. Never commit that file.

```sh
npx wrangler login                      # if not already authenticated
npm ci
npm run build:vinext

# Server-only secrets (each command prompts for the value)
for k in RELAYER_ACCOUNT_ID RELAYER_PRIVATE_KEY AGENT_ACCOUNT_ID AGENT_PRIVATE_KEY DEMO_MERCHANT_PRIVATE_KEY; do
  npx wrangler secret put "$k" --name localagentpay
done
# Optional:
# npx wrangler secret put NEAR_AI_API_KEY --name localagentpay
# npx wrangler secret put NEAR_AI_MODEL  --name localagentpay   # a model id listed by NEAR AI Cloud
# CHECKOUT_SESSION_SECRET is already set for the /explore travel checkout; keep it unchanged.

# Optional local check of the exact bundle (copy .dev.vars to dist/server/.dev.vars first, then delete it)
npm run start:vinext                     # http://localhost:8787
BASE=http://localhost:8787 npx tsx scripts/near/api-smoke.ts

npm run deploy:vinext -- --skip-build
BASE=https://localagentpay.mateen-nibtap.workers.dev npx tsx scripts/near/api-smoke.ts
```

The relayer root account pays for guest accounts (0.02 NEAR each) and gas. Top it up from the [testnet faucet](https://near-faucet.io/) if it runs low. Its balance is visible on NearBlocks.
