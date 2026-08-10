/**
 * Spend safety for an autonomous caller: price/payTo verification, per-call and
 * per-run budget caps, a rate limit, and idempotency so a looping agent cannot
 * double-charge or drain the wallet.
 */
import { createHash } from "node:crypto";
import type { Config } from "./config.js";

export class Guards {
  private spentUsdc = 0;
  private callTimes: number[] = [];
  private cache = new Map<string, { at: number; result: unknown }>();

  constructor(private cfg: Config) {}

  requestKey(manifest: unknown): string {
    return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  }

  getCached(key: string): unknown | undefined {
    const e = this.cache.get(key);
    if (e && Date.now() - e.at < this.cfg.idempotencyTtlMs) return e.result;
    if (e) this.cache.delete(key);
    return undefined;
  }

  putCached(key: string, result: unknown): void {
    this.cache.set(key, { at: Date.now(), result });
  }

  /** Refuse a 402 whose payTo isn't the pinned address (when one is configured). */
  verifyPayTo(payTo: string | undefined): void {
    if (!this.cfg.expectedPayTo) return;
    if (!payTo) {
      throw new Error(
        "could not read payTo from the 402 challenge; refusing (CONSENSA_EXPECTED_PAYTO is set)"
      );
    }
    if (payTo !== this.cfg.expectedPayTo) {
      throw new Error(`402 payTo ${payTo} != expected ${this.cfg.expectedPayTo}; refusing to pay`);
    }
  }

  checkRate(): void {
    const now = Date.now();
    this.callTimes = this.callTimes.filter((t) => now - t < 60_000);
    if (this.callTimes.length >= this.cfg.maxCallsPerMin) {
      throw new Error(`rate limit: more than ${this.cfg.maxCallsPerMin} paid calls/min`);
    }
    this.callTimes.push(now);
  }

  checkBudget(nextUsdc: number): void {
    if (nextUsdc > this.cfg.maxPerCallUsdc) {
      throw new Error(
        `per-call price ${nextUsdc} USDC exceeds MAX_PER_CALL_USDC ${this.cfg.maxPerCallUsdc}`
      );
    }
    if (this.spentUsdc + nextUsdc > this.cfg.maxSpendUsdcPerRun) {
      throw new Error(
        `run budget exceeded: ${this.spentUsdc} + ${nextUsdc} > MAX_SPEND_USDC_PER_RUN ${this.cfg.maxSpendUsdcPerRun}`
      );
    }
  }

  recordSpend(usdc: number): void {
    this.spentUsdc += usdc;
  }
}
