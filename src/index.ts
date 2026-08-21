/**
 * Consensa MCP server (stdio) — v0.1 MVP.
 *
 * Exposes three tools to an AI agent:
 *   - consensa_attribution_preview (free): which upstream OSS deps would be
 *     attributed on-chain, and the split — no payment.
 *   - consensa_clearance (paid): pay USDC and record an on-chain consent +
 *     attribution receipt for a dependency manifest.
 *   - consensa_receipt (free): look up a prior receipt by paymentTxId.
 *
 * Bring-your-own-wallet: the payer mnemonic is the ADOPTER's, from env. Consensa
 * never holds or spends it. Run against Testnet first (CONSENSA_NETWORK=testnet).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { Guards } from "./guards.js";
import { clearance, quote, receipt } from "./consensa.js";

const cfg = loadConfig();
const guards = new Guards(cfg);

const manifestShape = {
  manifest: z
    .object({
      type: z.string().describe('manifest type, e.g. "package.json"'),
      content: z.any().describe("manifest content, e.g. { dependencies: { 'left-pad': '^1.3.0' } }"),
    })
    .describe("dependency manifest to clear"),
};

const server = new McpServer({ name: "consensa-mcp", version: "0.1.0" });

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: `error: ${e instanceof Error ? e.message : String(e)}` }],
  };
}

server.tool(
  "consensa_attribution_preview",
  "Preview which upstream open-source dependencies a manifest would attribute on-chain, plus the payment split and price. Free — no payment.",
  manifestShape,
  async ({ manifest }) => {
    try {
      return ok(await quote(cfg, manifest));
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "consensa_clearance",
  "Pay for and record an on-chain consent + attribution receipt for a dependency manifest. SPENDS USDC from the configured wallet. Returns the receipt (paymentTxId, settleTxId, split, upstream).",
  manifestShape,
  async ({ manifest }) => {
    try {
      return ok(await clearance(cfg, manifest, guards));
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "consensa_receipt",
  "Look up a prior Consensa clearance receipt by paymentTxId. Free.",
  { paymentTxId: z.string().describe("Algorand payment transaction id") },
  async ({ paymentTxId }) => {
    try {
      return ok(await receipt(cfg, paymentTxId));
    } catch (e) {
      return fail(e);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr only — never stdout (stdout is the MCP transport).
console.error(
  `consensa-mcp ready · network=${cfg.network ?? "unset (resolved from the endpoint on the first paid call)"} · ` +
    `endpoint=${cfg.endpoint} · ` +
    `budget/run=$${cfg.maxSpendUsdcPerRun} · payTo-pin=${cfg.expectedPayTo ? "on" : "off"}`
);
