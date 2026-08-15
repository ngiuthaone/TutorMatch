import { describe, expect, it, vi } from "vitest";
import { createFinancialWorkerRuntime, runFinancialWorkerIteration } from "../src/workers/financial-worker-runtime.js";

type SweepResult = { data?: unknown; error?: unknown };
const service = () => ({
  sweepRefundExecutions: vi.fn(async (): Promise<SweepResult> => ({ data: { claimed: 0 } })),
  sweepRefundReconciliations: vi.fn(async (): Promise<SweepResult> => ({ data: { claimed: 0 } })),
  sweepPendingFinalizations: vi.fn(async (): Promise<SweepResult> => ({ data: { claimed: 0 } }))
});

describe("financial worker runtime", () => {
  it("runs each bounded sweep once and continues after one failure", async () => {
    const calls = service();
    calls.sweepRefundReconciliations.mockResolvedValueOnce({ error: new Error("database unavailable") });
    const logs: string[] = [];
    const result = await runFinancialWorkerIteration(calls, "worker-test", (level, event) => logs.push(`${level}:${event}`));
    expect(result.ok).toBe(false);
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
    expect(calls.sweepRefundReconciliations).toHaveBeenCalledOnce();
    expect(calls.sweepPendingFinalizations).toHaveBeenCalledOnce();
    expect(logs).toContain("error:financial_worker_sweep_failed");
  });

  it("does not overlap iterations and waits for in-flight work during shutdown", async () => {
    const calls = service();
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    calls.sweepRefundExecutions.mockImplementationOnce(async () => { entered(); await blocked; return { data: null }; });
    const runtime = createFinancialWorkerRuntime({ service: calls, workerId: "worker-test", intervalMs: 1, logger: vi.fn() });
    const running = runtime.start();
    await enteredPromise;
    const stopping = runtime.stop("SIGTERM");
    expect(runtime.health().status).toBe("stopping");
    release();
    await stopping;
    await running;
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
    expect(runtime.health().status).toBe("stopped");
  });
});
