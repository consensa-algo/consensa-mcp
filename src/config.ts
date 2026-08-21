/**
 * Consensa MCP server — runtime config from environment.
 *
 * Secrets (the payer mnemonic) come from the environment only — set them in the
 * MCP client's server `env` block, or the shell for local dev. Never commit them,
 * never log them. This module reads env; it never prints the mnemonic.
 */

export interface Config {
  /** Base URL of the Consensa endpoint (no trailing slash). */
  endpoint: string;
  /** Network the endpoint serves. **NO DEFAULT, by design (SD-017).** A default
   *  here can silently contradict the `endpoint` default and register the wrong
   *  payment scheme. Optional at load for the same reason `payerMnemonic` is:
   *  the free tools never need it. Resolved on the first paid call against what
   *  the endpoint reports at /v1/health, and never inferred from the URL. */
  network?: "testnet" | "mainnet";
  /** Optional algod URL override; defaults to the x402-avm network default. */
  algodUrl?: string;
  /** 25-word mnemonic of the payer (a DEDICATED low-balance spend wallet).
   *  Optional at load: only the paid `consensa_clearance` needs it, so the
   *  server can start and serve the free tools (preview, receipt) without one. */
  payerMnemonic?: string;
  /** If set, refuse to pay any 402 whose payTo differs from this. */
  expectedPayTo?: string;
  /** Spend guards. */
  maxSpendUsdcPerRun: number;
  maxPerCallUsdc: number;
  maxCallsPerMin: number;
  /** Idempotency cache TTL for identical manifests (ms). */
  idempotencyTtlMs: number;
}

function num(v: string | undefined, d: number): number {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

export function loadConfig(): Config {
  const endpoint = (
    process.env.CONSENSA_ENDPOINT || "https://consensa-endpoint-production.up.railway.app"
  ).replace(/\/+$/, "");
  const rawNetwork = process.env.CONSENSA_NETWORK?.trim().toLowerCase();
  const network =
    rawNetwork === "mainnet" ? "mainnet" : rawNetwork === "testnet" ? "testnet" : undefined;
  return {
    endpoint,
    network,
    algodUrl: process.env.CONSENSA_ALGOD_URL || undefined,
    payerMnemonic: process.env.CONSENSA_MCP_PAYER_MNEMONIC || undefined,
    expectedPayTo: process.env.CONSENSA_EXPECTED_PAYTO || undefined,
    maxSpendUsdcPerRun: num(process.env.MAX_SPEND_USDC_PER_RUN, 5.0),
    maxPerCallUsdc: num(process.env.MAX_PER_CALL_USDC, 0.02),
    maxCallsPerMin: num(process.env.MAX_CALLS_PER_MIN, 10),
    idempotencyTtlMs: num(process.env.IDEMPOTENCY_TTL_MS, 5 * 60 * 1000),
  };
}
