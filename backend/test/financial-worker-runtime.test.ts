import { describe, expect, it, vi } from "vitest";
import { createFinancialWorkerRuntime, runFinancialWorkerIteration } from "../src/workers/financial-worker-runtime.js";

type SweepResult = { data?: unknown; error?: unknown };
const service = () => ({
  sweepRefundExecutions: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: { claimed: 0 } })),
  sweepRefundReconciliations: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: { claimed: 0 } })),
  sweepPendingFinalizations: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: { claimed: 0 } })),
  sweepExpiredWorkshopBookings: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: { expired: 0 } })),
  sweepExpiredBookings: vi.fn(async (): Promise<{ data?: { expired: number }; error?: unknown }> => ({ data: { expired: 0 } }))
});

describe("financial worker runtime", () => {
  it("runs each bounded sweep once and continues after one failure", async () => {
    const calls = service();
    calls.sweepRefundReconciliations.mockResolvedValueOnce({ error: { message: "database unavailable" } });
    const logs: string[] = [];
    const result = await runFinancialWorkerIteration(calls, "worker-test", (level, event) => logs.push(`${level}:${event}`));
    expect(result.ok).toBe(false);
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
    expect(calls.sweepRefundReconciliations).toHaveBeenCalledOnce();
    expect(calls.sweepPendingFinalizations).toHaveBeenCalledOnce();
    expect(calls.sweepExpiredWorkshopBookings).toHaveBeenCalledOnce();
    expect(logs).toContain("error:financial_worker_sweep_failed");
  });

  it("runs every sweep on a normal non-aborted iteration", async () => {
    const calls = service();
    const result = await runFinancialWorkerIteration(calls, "worker-test", () => {});
    expect(result.ok).toBe(true);
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
    expect(calls.sweepRefundReconciliations).toHaveBeenCalledOnce();
    expect(calls.sweepPendingFinalizations).toHaveBeenCalledOnce();
    expect(calls.sweepExpiredWorkshopBookings).toHaveBeenCalledOnce();
  });

  it("stops the iteration when shutdown begins during the first sweep", async () => {
    const calls = service();
    let stopped = false;
    calls.sweepRefundExecutions.mockImplementationOnce(async () => { stopped = true; return { data: { claimed: 1, executed: 1 } }; });
    const result = await runFinancialWorkerIteration(calls, "worker-test", () => {}, () => stopped);
    expect(result.ok).toBe(true);
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
    expect(calls.sweepRefundReconciliations).not.toHaveBeenCalled();
    expect(calls.sweepPendingFinalizations).not.toHaveBeenCalled();
    expect(calls.sweepExpiredWorkshopBookings).not.toHaveBeenCalled();
  });

  it("does not invoke the next sweep when shutdown occurs between sweeps", async () => {
    const calls = service();
    let stopped = false;
    const base = calls.sweepRefundExecutions.getMockImplementation()!;
    calls.sweepRefundExecutions.mockImplementationOnce(async () => { const first = await base(); stopped = true; return first; });
    const result = await runFinancialWorkerIteration(calls, "worker-test", () => {}, () => stopped);
    expect(result.ok).toBe(true);
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
    expect(calls.sweepRefundReconciliations).not.toHaveBeenCalled();
    expect(calls.sweepPendingFinalizations).not.toHaveBeenCalled();
    expect(calls.sweepExpiredWorkshopBookings).not.toHaveBeenCalled();
  });

  it("does not invoke any sweep when shutdown is already active", async () => {
    const calls = service();
    const result = await runFinancialWorkerIteration(calls, "worker-test", () => {}, () => true);
    expect(result.ok).toBe(true);
    expect(calls.sweepRefundExecutions).not.toHaveBeenCalled();
    expect(calls.sweepRefundReconciliations).not.toHaveBeenCalled();
    expect(calls.sweepPendingFinalizations).not.toHaveBeenCalled();
    expect(calls.sweepExpiredWorkshopBookings).not.toHaveBeenCalled();
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

  it("keeps a healthy worker alive for the next scheduled iteration", async () => {
    const calls = service();
    const runtime = createFinancialWorkerRuntime({ service: calls, workerId: "worker-test", intervalMs: 2, logger: vi.fn() });
    const running = runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 8));
    expect(runtime.health().iterationCount).toBeGreaterThan(1);
    await runtime.stop("test");
    await running;
  });

  it.each(["SIGTERM", "SIGINT"] as const)("interrupts idle sleep on %s", async (signal) => {
    const calls = service();
    const runtime = createFinancialWorkerRuntime({ service: calls, workerId: "worker-test", intervalMs: 60_000, logger: vi.fn() });
    const running = runtime.start();
    await vi.waitFor(() => expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce());
    const startedAt = Date.now();
    await runtime.stop(signal);
    await running;
    expect(Date.now() - startedAt).toBeLessThan(250);
    expect(runtime.health().status).toBe("stopped");
  });

  it("does not start another iteration after shutdown begins", async () => {
    const calls = service();
    const runtime = createFinancialWorkerRuntime({ service: calls, workerId: "worker-test", intervalMs: 1, logger: vi.fn() });
    const running = runtime.start();
    await vi.waitFor(() => expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce());
    await runtime.stop("SIGTERM");
    await running;
    expect(calls.sweepRefundExecutions).toHaveBeenCalledOnce();
  });
});
