/**
 * Smoke test for the free /v1/quote endpoint (no wallet, no payment).
 * Run:  npx tsx mcp/scripts/smoke-quote.ts
 * Optionally override the target:  $env:CONSENSA_ENDPOINT="http://localhost:4021"
 */
const endpoint = (
  process.env.CONSENSA_ENDPOINT || "https://consensa-endpoint-production.up.railway.app"
).replace(/\/+$/, "");

const manifest = {
  type: "package.json",
  content: { dependencies: { "left-pad": "^1.3.0", "is-odd": "^3.0.1" } },
};

const res = await fetch(`${endpoint}/v1/quote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ manifest }),
});
const body = await res.json().catch(() => null);
console.log(`POST ${endpoint}/v1/quote -> ${res.status}`);
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
