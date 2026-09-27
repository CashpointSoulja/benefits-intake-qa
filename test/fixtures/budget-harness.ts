import { BudgetGate } from "../../src/budget/gate";

export { BudgetGate };

interface HarnessEnv {
  BUDGET_GATE: DurableObjectNamespace<BudgetGate>;
}

/** Test-only Worker that forwards requests to a real BudgetGate Durable Object. */
export default {
  async fetch(request: Request, env: HarnessEnv): Promise<Response> {
    const url = new URL(request.url);
    const ns = env.BUDGET_GATE;
    const stub = ns.get(ns.idFromName(url.searchParams.get("gate") ?? "lifetime"));
    const num = (k: string) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) : null);
    if (url.pathname === "/reserve") return Response.json(await stub.reserve(num("amount") ?? 0));
    if (url.pathname === "/settle")
      return Response.json(await stub.settle(url.searchParams.get("id") ?? "", num("actual"), url.searchParams.get("anomaly")));
    if (url.pathname === "/status") return Response.json(await stub.status());
    return new Response("not found", { status: 404 });
  },
};
