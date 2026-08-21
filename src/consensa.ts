/**
 * Consensa client: attribution preview (free), receipt lookup (free), and the
 * paid x402 clearance. The clearance flow mirrors
 * spikes/g4-mainnet-reverify/client-prod-clearance.ts, network-parameterized,
 * with the spend guards applied BEFORE any signature.
 */
import algosdk from "algosdk";
import { x402Client } from "@x402-avm/core/client";
import { x402HTTPClient } from "@x402-avm/core/http";
import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  DEFAULT_ALGOD_MAINNET,
  DEFAULT_ALGOD_TESTNET,
  toClientAvmSigner,
} from "@x402-avm/avm";
import { ExactAvmScheme } from "@x402-avm/avm/exact/client";
import type { Config } from "./config.js";
import type { Guards } from "./guards.js";

export type Manifest = { type: string; content?: unknown };

export async function quote(cfg: Config, manifest: Manifest): Promise<unknown> {
  const res = await fetch(`${cfg.endpoint}/v1/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`quote failed ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

export async function receipt(cfg: Config, paymentTxId: string): Promise<unknown> {
  const res = await fetch(`${cfg.endpoint}/v1/receipts/${encodeURIComponent(paymentTxId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`receipt lookup ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

/**
 * SD-017: settle which network we are on by ASKING the endpoint, never by
 * inferring it from the URL — a URL does not carry its network, and guessing
 * would repeat the failure where a silent default became a decision nobody made.
 *
 * `CONSENSA_NETWORK` unset means "ask"; set means "assert". Mainnet additionally
 * requires the operator to have said so, because the first real spend should be
 * an explicit act (same principle as SD-009's launch-intent flag).
 *
 * Cached per process: one probe, then reuse.
 */
let _resolvedNetwork: "testnet" | "mainnet" | undefined;

async function reportedNetwork(cfg: Config): Promise<"testnet" | "mainnet" | undefined> {
  if (_resolvedNetwork) return _resolvedNetwork;
  try {
    const res = await fetch(`${cfg.endpoint}/v1/health`);
    if (!res.ok) return undefined;
    const reported = (await res.json())?.network;
    if (reported === "algorand-mainnet") _resolvedNetwork = "mainnet";
    else if (reported === "algorand-testnet") _resolvedNetwork = "testnet";
    return _resolvedNetwork;
  } catch {
    return undefined; // unreachable endpoint; the caller decides what that means
  }
}

export async function resolveNetwork(cfg: Config): Promise<"testnet" | "mainnet"> {
  const reported = await reportedNetwork(cfg);

  if (reported === undefined) {
    // Could not observe. Never treat "cannot check" as "fine" (SD-010): proceed
    // only on an explicit declaration, and refuse when there is nothing to trust.
    if (cfg.network) return cfg.network;
    throw new Error(
      `Could not read ${cfg.endpoint}/v1/health to determine the network, and ` +
        `CONSENSA_NETWORK is not set. Set CONSENSA_NETWORK to the network your ` +
        `endpoint serves ("mainnet" or "testnet"), or check that the endpoint is reachable.`
    );
  }

  if (cfg.network && cfg.network !== reported) {
    throw new Error(
      `CONSENSA_NETWORK=${cfg.network} but ${cfg.endpoint} reports algorand-${reported}. ` +
        `Set CONSENSA_NETWORK=${reported}, or point CONSENSA_ENDPOINT at a ${cfg.network} endpoint.`
    );
  }

  if (!cfg.network && reported === "mainnet") {
    throw new Error(
      `CONSENSA_NETWORK is not set, and ${cfg.endpoint} reports algorand-mainnet. ` +
        `Paying here spends REAL USDC. Set CONSENSA_NETWORK=mainnet to confirm that is ` +
        `intended, or point CONSENSA_ENDPOINT at a testnet endpoint.`
    );
  }

  return reported;
}

/* The decoded PaymentRequired shape can vary across x402-avm versions, so read
   payTo/price defensively from the most likely field paths. */
function extractPayTo(pr: any): string | undefined {
  const a = pr?.accepts;
  return (
    a?.payTo ??
    (Array.isArray(a) ? a[0]?.payTo : undefined) ??
    pr?.payTo ??
    pr?.requirementTemplate?.payTo
  );
}
export async function clearance(
  cfg: Config,
  manifest: Manifest,
  guards: Guards
): Promise<unknown> {
  const key = guards.requestKey(manifest);
  const cached = guards.getCached(key);
  if (cached) return { ...(cached as object), idempotent: true };

  const url = `${cfg.endpoint}/v1/clearance`;
  // Before anything is signed, and before any spend guard: agree with the
  // endpoint about which chain this is (SD-017). Throws rather than guessing.
  const network = await resolveNetwork(cfg);
  const caip2 = network === "mainnet" ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
  const algodUrl =
    cfg.algodUrl || (network === "mainnet" ? DEFAULT_ALGOD_MAINNET : DEFAULT_ALGOD_TESTNET);

  if (!cfg.payerMnemonic) {
    throw new Error(
      "CONSENSA_MCP_PAYER_MNEMONIC is required to pay for a clearance; set it in the MCP server env."
    );
  }
  const payer = algosdk.mnemonicToSecretKey(cfg.payerMnemonic);
  const signer = toClientAvmSigner(Buffer.from(payer.sk).toString("base64"));
  const client = new x402Client();
  client.register(caip2, new ExactAvmScheme(signer, { algodUrl }));
  const http = new x402HTTPClient(client);
  const hmap = (h: Headers) => (name: string) => h.get(name);

  const reqBody = JSON.stringify({ manifest });
  const first = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: reqBody,
  });
  if (first.status !== 402) {
    throw new Error(`expected 402 from ${url}, got ${first.status}: ${await first.text()}`);
  }
  const pr = http.getPaymentRequiredResponse(hmap(first.headers));

  // ---- spend safety BEFORE signing ----
  guards.verifyPayTo(extractPayTo(pr));
  // exact price from the free /v1/quote (single source of truth); conservative
  // fallback to the per-call cap only if the quote is unavailable.
  let priceUsdc = cfg.maxPerCallUsdc;
  try {
    const q = (await quote(cfg, manifest)) as { price?: { amount?: string } };
    const p = Number(q?.price?.amount);
    if (Number.isFinite(p) && p > 0) priceUsdc = p;
  } catch {
    /* keep conservative fallback */
  }
  guards.checkRate();
  guards.checkBudget(priceUsdc);

  const payload = await http.createPaymentPayload(pr);
  const payHeaders = http.encodePaymentSignatureHeader(payload);
  const second = await fetch(url, {
    method: "POST",
    headers: { ...payHeaders, "content-type": "application/json" },
    body: reqBody,
  });
  const body = await second.json();
  if (second.status !== 200) {
    throw new Error(`clearance not accepted ${second.status}: ${JSON.stringify(body)}`);
  }
  guards.recordSpend(priceUsdc);
  const settle = http.getPaymentSettleResponse(hmap(second.headers));
  const result = {
    payer: payer.addr.toString(),
    priceUsdc,
    network,
    settle,
    ...(body as object),
  };
  guards.putCached(key, result);
  return result;
}
