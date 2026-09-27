import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { BudgetLedger, usdToMicros, type SqlBinding, type SqlCell, type SqlLike, type Transact } from "../src/budget/ledger";

function sqlite(db = new DatabaseSync(":memory:")) {
  const sql: SqlLike = {
    exec: (q: string, ...b: SqlBinding[]) => {
      const rows = db.prepare(q).all(...b) as Record<string, SqlCell>[];
      return { toArray: () => rows };
    },
  };
  const transact: Transact = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  return { db, ledger: () => new BudgetLedger(sql, transact) };
}

describe("usdToMicros", () => {
  it("parses plain decimal USD and rejects anything else", () => {
    expect(usdToMicros("1.00")).toBe(1_000_000);
    expect(usdToMicros("0.000001")).toBe(1);
    for (const bad of [undefined, "", "-1", "0", "1e3", "abc", "1.0000001", "$1"]) expect(usdToMicros(bad)).toBeNull();
  });
});

describe("BudgetLedger", () => {
  it("reserves up to the limit and refuses the call that would exceed it", () => {
    const l = sqlite().ledger();
    expect(l.reserve(1000, 400, "a", 0)).toMatchObject({ ok: true, committed: 400 });
    expect(l.reserve(1000, 600, "b", 0)).toMatchObject({ ok: true, committed: 1000 });
    expect(l.reserve(1000, 1, "c", 0)).toMatchObject({ ok: false, reason: "budget_exhausted", committed: 1000 });
  });

  it("settling with a known actual cost releases the unused reservation", () => {
    const l = sqlite().ledger();
    const r = l.reserve(1000, 900, "a", 0);
    expect(r.ok).toBe(true);
    expect(l.settle("a", 100, 1)).toEqual({ id: "a", charged: 100, committed: 100 });
    expect(l.reserve(1000, 900, "b", 2).ok).toBe(true);
  });

  it("an unknown cost keeps the full reservation charged, and open reservations count", () => {
    const l = sqlite().ledger();
    l.reserve(1000, 700, "a", 0);
    l.reserve(1000, 300, "b", 0);
    expect(l.settle("a", null, 1).charged).toBe(700);
    expect(l.status(1000)).toEqual({ limit: 1000, committed: 1000, remaining: 0, open_reservations: 1 });
    expect(l.reserve(1000, 1, "c", 2).ok).toBe(false);
  });

  it("rejects double or unknown settlement", () => {
    const l = sqlite().ledger();
    l.reserve(1000, 10, "a", 0);
    l.settle("a", 5, 1);
    expect(() => l.settle("a", 5, 2)).toThrow(/already settled/);
    expect(() => l.settle("nope", 5, 2)).toThrow(/unknown/);
  });

  it("fails closed without a valid limit or amount", () => {
    const l = sqlite().ledger();
    expect(l.reserve(null, 10, "a", 0)).toMatchObject({ ok: false, reason: "limit_invalid" });
    for (const amt of [0, -5, 1.5, Number.NaN]) expect(l.reserve(1000, amt, `x${amt}`, 0)).toMatchObject({ ok: false, reason: "amount_invalid" });
    expect(l.status(1000).committed).toBe(0);
  });

  it("keeps the first limit as a lifetime ceiling: can be lowered, never raised", () => {
    const l = sqlite().ledger();
    l.reserve(1000, 800, "a", 0);
    expect(l.reserve(5000, 300, "b", 0)).toMatchObject({ ok: false, limit: 1000 });
    expect(l.reserve(null, 100, "c", 0)).toMatchObject({ ok: true, limit: 1000 });
    expect(l.reserve(500, 1, "d", 0)).toMatchObject({ ok: false, limit: 500 });
    expect(l.reserve(1000, 1, "e", 0)).toMatchObject({ ok: false, limit: 500 });
  });

  it("persists spend across ledger instances on the same database", () => {
    const s = sqlite();
    s.ledger().reserve(1000, 600, "a", 0);
    const again = s.ledger();
    expect(again.status(1000).committed).toBe(600);
    expect(again.reserve(1000, 500, "b", 0).ok).toBe(false);
  });

  it("never commits more than the limit across many reservations", () => {
    const l = sqlite().ledger();
    let granted = 0;
    for (let i = 0; i < 500; i++) {
      const amt = 1 + ((i * 7919) % 97);
      const r = l.reserve(10_000, amt, `r${i}`, i);
      if (r.ok) {
        granted += amt;
        if (i % 3 === 0) l.settle(r.id, null, i);
      }
    }
    expect(granted).toBeLessThanOrEqual(10_000);
    expect(l.status(10_000).committed).toBe(granted);
  });
});
