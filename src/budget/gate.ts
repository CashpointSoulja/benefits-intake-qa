import { DurableObject } from "cloudflare:workers";
import { BudgetLedger, usdToMicros, type BudgetStatus, type ReserveResult, type SettleResult } from "./ledger";

export interface BudgetEnv {
  AI_LIFETIME_BUDGET_USD?: string;
}

/**
 * Single SQLite-backed Durable Object instance that serialises every budget decision.
 * The limit comes from this object's own env, never from the caller.
 */
export class BudgetGate extends DurableObject<BudgetEnv> {
  private readonly ledger: BudgetLedger;

  constructor(ctx: DurableObjectState, env: BudgetEnv) {
    super(ctx, env);
    this.ledger = new BudgetLedger(ctx.storage.sql, (fn) => ctx.storage.transactionSync(fn));
  }

  private limit(): number | null {
    return usdToMicros(this.env.AI_LIFETIME_BUDGET_USD);
  }

  reserve(amountMicros: number): ReserveResult {
    return this.ledger.reserve(this.limit(), amountMicros, crypto.randomUUID(), Date.now());
  }

  settle(id: string, actualMicros: number | null): SettleResult {
    return this.ledger.settle(id, actualMicros, Date.now());
  }

  status(): BudgetStatus {
    return this.ledger.status(this.limit());
  }
}
