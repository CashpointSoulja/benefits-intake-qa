/**
 * Lifetime spend ledger for paid model calls, in integer micro-USD.
 *
 * A call must reserve its worst-case cost before it is made. Committed spend is the sum of
 * settled actual costs plus every open reservation, so a crashed or unanswered call stays
 * charged at its worst case (fail closed). The first limit seen is persisted and the effective
 * limit is the lower of the stored and configured values: lowering the configured limit takes
 * effect, raising it does not.
 */
export type SqlBinding = string | number | null;
export type SqlCell = ArrayBuffer | string | number | null;

export interface SqlLike {
  exec(query: string, ...bindings: SqlBinding[]): { toArray(): Record<string, SqlCell>[] };
}

export type Transact = <T>(fn: () => T) => T;

export type ReserveResult =
  | { ok: true; id: string; reserved: number; committed: number; limit: number }
  | { ok: false; reason: "limit_invalid" | "amount_invalid" | "budget_exhausted"; committed: number; limit: number };

export interface SettleResult {
  id: string;
  charged: number;
  committed: number;
}

export interface BudgetStatus {
  limit: number;
  committed: number;
  remaining: number;
  open_reservations: number;
}

const isMicros = (n: number) => Number.isSafeInteger(n) && n > 0;

export function usdToMicros(usd: string | undefined): number | null {
  if (usd === undefined || !/^\d+(\.\d{1,6})?$/.test(usd.trim())) return null;
  const micros = Math.round(Number(usd.trim()) * 1_000_000);
  return isMicros(micros) ? micros : null;
}

export class BudgetLedger {
  constructor(
    private readonly sql: SqlLike,
    private readonly transact: Transact,
  ) {
    sql.exec(
      `CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        reserved INTEGER NOT NULL CHECK (reserved > 0),
        actual INTEGER CHECK (actual IS NULL OR actual >= 0),
        status TEXT NOT NULL CHECK (status IN ('reserved', 'settled')),
        created_at INTEGER NOT NULL,
        settled_at INTEGER
      )`,
    );
    sql.exec(`CREATE TABLE IF NOT EXISTS budget_config (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`);
  }

  private effectiveLimit(configured: number | null): number | null {
    const row = this.sql.exec(`SELECT v FROM budget_config WHERE k = 'lifetime_limit'`).toArray()[0];
    const stored = row ? Number(row.v) : null;
    if (configured === null || !isMicros(configured)) return stored;
    if (stored === null) {
      this.sql.exec(`INSERT INTO budget_config (k, v) VALUES ('lifetime_limit', ?)`, configured);
      return configured;
    }
    if (configured < stored) {
      this.sql.exec(`UPDATE budget_config SET v = ? WHERE k = 'lifetime_limit'`, configured);
      return configured;
    }
    return stored;
  }

  private committed(): number {
    const row = this.sql
      .exec(`SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN actual ELSE reserved END), 0) AS c FROM reservations`)
      .toArray()[0];
    return Number(row.c);
  }

  reserve(configuredLimit: number | null, amount: number, id: string, now: number): ReserveResult {
    return this.transact(() => {
      const limit = this.effectiveLimit(configuredLimit);
      const committed = this.committed();
      if (limit === null) return { ok: false, reason: "limit_invalid", committed, limit: 0 };
      if (!isMicros(amount)) return { ok: false, reason: "amount_invalid", committed, limit };
      if (committed + amount > limit) return { ok: false, reason: "budget_exhausted", committed, limit };
      this.sql.exec(
        `INSERT INTO reservations (id, reserved, status, created_at) VALUES (?, ?, 'reserved', ?)`,
        id,
        amount,
        now,
      );
      return { ok: true, id, reserved: amount, committed: committed + amount, limit };
    });
  }

  /** `actual === null` means the cost is unknown; the full reservation stays charged. */
  settle(id: string, actual: number | null, now: number): SettleResult {
    return this.transact(() => {
      const row = this.sql.exec(`SELECT reserved, status FROM reservations WHERE id = ?`, id).toArray()[0];
      if (!row) throw new Error("unknown reservation");
      if (row.status !== "reserved") throw new Error("reservation already settled");
      const reserved = Number(row.reserved);
      const charged = actual === null || !Number.isSafeInteger(actual) || actual < 0 ? reserved : actual;
      this.sql.exec(
        `UPDATE reservations SET actual = ?, status = 'settled', settled_at = ? WHERE id = ?`,
        charged,
        now,
        id,
      );
      return { id, charged, committed: this.committed() };
    });
  }

  status(configuredLimit: number | null): BudgetStatus {
    return this.transact(() => {
      const limit = this.effectiveLimit(configuredLimit) ?? 0;
      const committed = this.committed();
      const open = this.sql.exec(`SELECT COUNT(*) AS n FROM reservations WHERE status = 'reserved'`).toArray()[0];
      return { limit, committed, remaining: Math.max(0, limit - committed), open_reservations: Number(open.n) };
    });
  }
}
