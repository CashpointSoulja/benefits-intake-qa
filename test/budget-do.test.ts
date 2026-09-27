import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BudgetStatus, ReserveResult } from "../src/budget/ledger";

let script = "";
const persistDir = mkdtempSync(join(tmpdir(), "budget-do-"));
const instances: Miniflare[] = [];

beforeAll(async () => {
  const out = await build({
    entryPoints: [join(dirname(fileURLToPath(import.meta.url)), "fixtures", "budget-harness.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    external: ["cloudflare:workers"],
    write: false,
  });
  script = out.outputFiles[0].text;
});

afterAll(async () => {
  await Promise.all(instances.map((m) => m.dispose()));
  rmSync(persistDir, { recursive: true, force: true });
});

function start(limitUsd?: string, persist = false) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    ...(persist ? { resourcePersistencePath: persistDir } : {}),
    workers: [
      {
        modules: true,
        script,
        compatibilityDate: "2025-09-01",
        durableObjects: { BUDGET_GATE: { className: "BudgetGate", useSQLite: true } },
        bindings: limitUsd === undefined ? {} : { AI_LIFETIME_BUDGET_USD: limitUsd },
      },
    ],
  }));
  instances.push(mf);
  return mf;
}

const call = async <T>(mf: Miniflare, path: string) => (await (await mf.dispatchFetch(`http://gate${path}`)).json()) as T;

describe("BudgetGate Durable Object (real workerd SQLite, concurrent requests)", () => {
  it("never grants more than the limit under 200 concurrent reservations", async () => {
    const mf = start("0.001");
    const results = await Promise.all(
      Array.from({ length: 200 }, () => call<ReserveResult>(mf, "/reserve?gate=concurrent&amount=7")),
    );
    const granted = results.filter((r) => r.ok).length;
    expect(granted).toBe(Math.floor(1000 / 7));
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "budget_exhausted")).toBe(true);
    const status = await call<BudgetStatus>(mf, "/status?gate=concurrent");
    expect(status).toMatchObject({ limit: 1000, committed: granted * 7, open_reservations: granted });
  }, 30_000);

  it("clamps any configured limit to the $1.80 code cap", async () => {
    const mf = start("5.00");
    expect(await call<ReserveResult>(mf, "/reserve?gate=cap&amount=1800001")).toMatchObject({
      ok: false,
      reason: "budget_exhausted",
      limit: 1_800_000,
    });
    expect(await call<ReserveResult>(mf, "/reserve?gate=cap&amount=1800000")).toMatchObject({ ok: true });
  }, 30_000);

  it("keeps the full reservation for an over-reservation cost and halts further calls", async () => {
    const mf = start("1.00");
    const r = await call<ReserveResult>(mf, "/reserve?gate=anomaly&amount=100");
    expect(r.ok).toBe(true);
    const id = r.ok ? r.id : "";
    expect(await call(mf, `/settle?gate=anomaly&id=${id}&actual=5000`)).toMatchObject({
      charged: 100,
      anomaly: "actual_exceeds_reservation",
    });
    expect(await call<ReserveResult>(mf, "/reserve?gate=anomaly&amount=1")).toMatchObject({ ok: false, reason: "anomaly_halt" });
  }, 30_000);

  it("persists spend and the lowered limit across restarts, and a higher limit is not applied", async () => {
    const first = start("0.50", true);
    expect((await call<ReserveResult>(first, "/reserve?gate=persist&amount=400000")).ok).toBe(true);
    await first.dispose();
    const second = start("1.80", true);
    expect(await call<BudgetStatus>(second, "/status?gate=persist")).toMatchObject({ limit: 500_000, committed: 400_000 });
    expect(await call<ReserveResult>(second, "/reserve?gate=persist&amount=100001")).toMatchObject({ ok: false });
  }, 30_000);
});
