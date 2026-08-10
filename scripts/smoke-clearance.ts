/**
 * ONE real clearance through the MCP's own code path (config -> guards -> x402
 * -> settlement). Exercises the exact function the `consensa_clearance` tool
 * calls, without the MCP transport layer.
 *
 * SPENDS REAL FUNDS on the configured network. Set env first (mnemonic DIRECT,
 * never pasted into chat). Recommended: keep CONSENSA_EXPECTED_PAYTO set — if the
 * 402's payTo can't be read or differs, it refuses BEFORE signing (no funds move).
 *
 * Run:  npx tsx mcp/scripts/smoke-clearance.ts
 */
import { loadConfig } from "../src/config.js";
import { Guards } from "../src/guards.js";
import { clearance } from "../src/consensa.js";

const cfg = loadConfig();
console.error(
  `network=${cfg.network} · endpoint=${cfg.endpoint} · payTo-pin=${cfg.expectedPayTo ? "on" : "off"} · ` +
    `budget/run=$${cfg.maxSpendUsdcPerRun} · max/call=$${cfg.maxPerCallUsdc}`
);

const guards = new Guards(cfg);
const manifest = { type: "package.json", content: { dependencies: { "left-pad": "^1.3.0" } } };

const result = await clearance(cfg, manifest, guards);
console.log(JSON.stringify(result, null, 2));
