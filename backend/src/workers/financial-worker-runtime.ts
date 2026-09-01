import type { PaymentService } from "../services/payment-service.js";

type SweepName = "refund_execution" | "refund_reconciliation" | "payment_finalization" | "sweep_expired_workshop_bookings" | "booking_expiry";
export type FinancialWorkerLogger = (level: "debug" | "info" | "warn" | "error", event: string, fields?: Record<string, unknown>) => void;
export type FinancialWorkerHealth = {
  status: "starting" | "ready" | "running" | "degraded" | "stopping" | "stopped";
  startedAt: string | null;
  lastIterationAt: string | null;
  lastSuccessfulIterationAt: string | null;
  iterationCount: number;
  lastError: string | null;
};

const errorMessage = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "unknown worker error";
  return message.slice(0, 500);
};

export async function runFinancialWorkerIteration(service: Pick<PaymentService, "sweepRefundExecutions" | "sweepRefundReconciliations" | "sweepPendingFinalizations" | "sweepExpiredWorkshopBookings" | "sweepExpiredBookings">, workerId: string, logger: FinancialWorkerLogger, isStopped?: () => boolean): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const sweeps: Array<[SweepName, () => Promise<{ data?: unknown; error?: unknown }>]> = [
    ["refund_execution", () => service.sweepRefundExecutions(workerId)],
    ["refund_reconciliation", () => service.sweepRefundReconciliations(workerId)],
    ["payment_finalization", () => service.sweepPendingFinalizations(workerId)],
    ["sweep_expired_workshop_bookings", () => service.sweepExpiredWorkshopBookings(workerId)],
    ["booking_expiry", () => service.sweepExpiredBookings(workerId)]
  ];
  for (const [name, sweep] of sweeps) {
    // No sweep may start once shutdown has begun: claiming after stop would
    // acquire a fresh lease for work the worker can no longer process. A
    // normal shutdown therefore ends the iteration here without invoking the
    // remaining sweeps.
    if (isStopped?.()) break;
    try {
      const result = await sweep();
      if (result.error) {
        const message = errorMessage(result.error);
        errors.push(`${name}: ${message}`);
        logger("error", "financial_worker_sweep_failed", { sweep: name, error: message });
      } else {
        logger("debug", "financial_worker_sweep_completed", { sweep: name, summary: result.data ?? null });
      }
    } catch (error) {
      const message = errorMessage(error);
      errors.push(`${name}: ${message}`);
      logger("error", "financial_worker_sweep_failed", { sweep: name, error: message });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function createFinancialWorkerRuntime(input: {
  service: Pick<PaymentService, "sweepRefundExecutions" | "sweepRefundReconciliations" | "sweepPendingFinalizations" | "sweepExpiredWorkshopBookings" | "sweepExpiredBookings">;
  workerId: string;
  intervalMs: number;
  logger: FinancialWorkerLogger;
  onStop?: () => void;
  now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  let stopping = false;
  let started = false;
  let inFlight: Promise<void> | null = null;
  let wake: (() => void) | null = null;
  let sleepTimer: ReturnType<typeof setTimeout> | null = null;
  const health: FinancialWorkerHealth = { status: "starting", startedAt: null, lastIterationAt: null, lastSuccessfulIterationAt: null, iterationCount: 0, lastError: null };
  const waitForNextIteration = () => new Promise<void>((resolve) => {
    const finish = () => {
      if (sleepTimer !== null) clearTimeout(sleepTimer);
      sleepTimer = null;
      wake = null;
      resolve();
    };
    wake = finish;
    // Keep the timer referenced: this is the worker's liveness handle. An
    // unref'ed timer would let Node exit after the first sweep when no other
    // socket/timer happens to be active.
    sleepTimer = setTimeout(finish, input.intervalMs);
  });
  const iteration = async () => {
    health.status = "running";
    health.iterationCount += 1;
    health.lastIterationAt = now().toISOString();
    input.logger("info", "financial_worker_iteration_started", { iteration: health.iterationCount });
    const result = await runFinancialWorkerIteration(input.service, input.workerId, input.logger, () => stopping);
    if (result.ok) {
      health.lastSuccessfulIterationAt = now().toISOString();
      health.lastError = null;
      health.status = "ready";
    } else {
      health.lastError = result.errors.join("; ").slice(0, 500);
      health.status = "degraded";
      input.logger("warn", "financial_worker_attention_required", { errorCount: result.errors.length });
    }
    input.logger(result.ok ? "info" : "warn", "financial_worker_iteration_completed", { iteration: health.iterationCount, ok: result.ok, errorCount: result.errors.length });
  };
  const start = async () => {
    if (started) return;
    started = true;
    health.startedAt = now().toISOString();
    input.logger("info", "financial_worker_started", { intervalMs: input.intervalMs });
    while (!stopping) {
      inFlight = iteration();
      try { await inFlight; } finally { inFlight = null; }
      if (!stopping) await waitForNextIteration();
    }
  };
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    health.status = "stopping";
    input.onStop?.();
    wake?.();
    input.logger("info", "financial_worker_stopping", { signal });
    if (inFlight) await inFlight;
    health.status = "stopped";
    input.logger("info", "financial_worker_stopped", { iterations: health.iterationCount });
  };
  return { start, stop, health: () => ({ ...health }) };
}
