/**
 * Lifetime spend ledger for paid model calls, in integer micro-USD.
 *
 * A call must reserve its worst-case cost before it is made. Committed spend is the sum of
 * settled actual costs plus every open reservation, so a crashed or unanswered call stays
 * charged at its worst case (fail closed). The first limit seen is persisted and the effective
 * limit is the lowest of the stored value, the configured value and `LIFETIME_CAP_MICROS`:
 * lowering takes effect, raising never does. A reported cost above its reservation is not
 * charged beyond the reservation (the cap holds) but is recorded as an anomaly, and any
 * anomaly halts all further reservations until the ledger is reviewed.
 */
export type SqlBinding = string | number | null;
export type SqlCell = ArrayBuffer | string | number | null;

export interface SqlLike {
  exec(query: string, ...bindings: SqlBinding[]): { toArray(): Record<string, SqlCell>[] };
}

export type Transact = <T>(fn: () => T) => T;

/** $1.80: a margin under the owner's $2 total, never-to-exceed spend for this demo. */
export const LIFETIME_CAP_MICROS = 1_800_000;

export type ReserveResult =
  | { ok: true; id: string; reserved: number; committed: number; limit: number }
  | {
      ok: false;
      reason: "limit_invalid" | "amount_invalid" | "budget_exhausted" | "anomaly_halt";
      committed: number;
      limit: number;
    };

export interface SettleResult {
  id: string;
  charged: number;
  committed: number;
  anomaly: string | null;
}

export interface BudgetStatus {
  limit: number;
  committed: number;
  remaining: number;
  open_reservations: number;
  anomalies: number;
}

const isMicros = (n: number) => Number.isSafeInteger(n) && n > 0;

/** undefined when unset, null when set but not a positive USD amount with ≤ 6 decimals. */
export function usdToMicros(usd: string | undefined): number | null | undefined {
  if (usd === undefined || usd.trim() === "") return undefined;
  if (!/^\d+(\.\d{1,6})?$/.test(usd.trim())) return null;
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
        reported INTEGER,
        anomaly TEXT,
        status TEXT NOT NULL CHECK (status IN ('reserved', 'settled')),
        created_at INTEGER NOT NULL,
        settled_at INTEGER
      )`,
    );
    sql.exec(`CREATE TABLE IF NOT EXISTS budget_config (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`);
  }

  /** `configured`: undefined = not set (use the cap), null = set but invalid (fail closed). */
  private effectiveLimit(configured: number | null | undefined): number | null {
    if (configured === null || (configured !== undefined && !isMicros(configured))) return null;
    const wanted = Math.min(configured ?? LIFETIME_CAP_MICROS, LIFETIME_CAP_MICROS);
    const row = this.sql.exec(`SELECT v FROM budget_config WHERE k = 'lifetime_limit'`).toArray()[0];
    if (!row) {
      this.sql.exec(`INSERT INTO budget_config (k, v) VALUES ('lifetime_limit', ?)`, wanted);
      return wanted;
    }
    const stored = Number(row.v);
    if (wanted < stored) {
      this.sql.exec(`UPDATE budget_config SET v = ? WHERE k = 'lifetime_limit'`, wanted);
      return wanted;
    }
    return stored;
  }

  private anomalies(): number {
    return Number(this.sql.exec(`SELECT COUNT(*) AS n FROM reservations WHERE anomaly IS NOT NULL`).toArray()[0].n);
  }

  private committed(): number {
    const row = this.sql
      .exec(`SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN actual ELSE reserved END), 0) AS c FROM reservations`)
      .toArray()[0];
    return Number(row.c);
  }

  reserve(configuredLimit: number | null | undefined, amount: number, id: string, now: number): ReserveResult {
    return this.transact(() => {
      const limit = this.effectiveLimit(configuredLimit);
      const committed = this.committed();
      if (limit === null) return { ok: false, reason: "limit_invalid", committed, limit: 0 };
      if (this.anomalies() > 0) return { ok: false, reason: "anomaly_halt", committed, limit };
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

  /**
   * Charges `actual` when it is a valid cost within the reservation; otherwise the full
   * reservation stays charged. `actual === null` means the cost is unknown. A cost above the
   * reservation, or a caller-reported `anomaly`, is recorded and halts future reservations.
   */
  settle(id: string, actual: number | null, now: number, anomaly: string | null = null): SettleResult {
    return this.transact(() => {
      const row = this.sql.exec(`SELECT reserved, status FROM reservations WHERE id = ?`, id).toArray()[0];
      if (!row) throw new Error("unknown reservation");
      if (row.status !== "reserved") throw new Error("reservation already settled");
      const reserved = Number(row.reserved);
      const valid = actual !== null && Number.isSafeInteger(actual) && actual >= 0;
      let flag = anomaly;
      if (actual !== null && !valid) flag ??= "invalid_actual";
      if (valid && actual > reserved) flag ??= "actual_exceeds_reservation";
      const charged = valid && flag === null ? actual : reserved;
      this.sql.exec(
        `UPDATE reservations SET actual = ?, reported = ?, anomaly = ?, status = 'settled', settled_at = ? WHERE id = ?`,
        charged,
        valid ? actual : null,
        flag,
        now,
        id,
      );
      if (flag) console.error(`budget anomaly on reservation ${id}: ${flag} (reserved=${reserved}, reported=${actual})`);
      return { id, charged, committed: this.committed(), anomaly: flag };
    });
  }

  status(configuredLimit: number | null | undefined): BudgetStatus {
    return this.transact(() => {
      const limit = this.effectiveLimit(configuredLimit) ?? 0;
      const committed = this.committed();
      const open = this.sql.exec(`SELECT COUNT(*) AS n FROM reservations WHERE status = 'reserved'`).toArray()[0];
      return {
        limit,
        committed,
        remaining: Math.max(0, limit - committed),
        open_reservations: Number(open.n),
        anomalies: this.anomalies(),
      };
    });
  }
}
