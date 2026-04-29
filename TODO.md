# Cloudflare Workers Monorepo Fix - TODO

## Approved Plan Steps (Completed ✓ / Pending ☐)

**1. Create worker/ directory structure** ✓
- `worker/src/index.js` (move server/index.js)
- `worker/package.json` 
- `worker/wrangler.toml`
- `worker/migrations/` (move from server/migrations/)

**2. Create frontend fixes** ✓
- `public/_headers` (COOP headers)

**3. Update root package.json** ✓
- Add `dev:worker`, `deploy:worker` scripts
- Update/remove `dev:server`
- Remove `wrangler` from root devDependencies

**4. Cleanup** ☐
- Remove old `server/` Worker files

**5. Install & Deploy** ☐
```
cd worker && npm install
npx wrangler secret put [keys...]
npx wrangler deploy
cd .. && npm run build
```

**Progress: 3/5 steps complete**

