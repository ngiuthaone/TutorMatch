import { createHmac, timingSafeEqual } from "node:crypto";

export type VnpayConfig = { tmnCode: string; hashSecret: string; paymentUrl: string; returnUrl: string; ipnUrl: string };
export type VnpayFields = Record<string, string>;
export const DEFAULT_VNPAY_REQUEST_TIMEOUT_MS = 15_000;

function sortedQuery(fields: VnpayFields) {
  return Object.keys(fields).filter((key) => fields[key] !== "" && fields[key] !== undefined).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key] ?? "")}`).join("&");
}
function digest(value: string, secret: string) { return createHmac("sha512", secret).update(value, "utf8").digest("hex"); }

export function buildVnpayPaymentUrl(config: VnpayConfig, input: { merchantReference: string; amountVnd: number; orderInfo: string; createdAt: Date; returnUrl?: string }) {
  const d = input.createdAt;
  const returnUrl = new URL(config.returnUrl);
  if (input.returnUrl) {
    const override = new URL(input.returnUrl);
    for (const [key, value] of override.searchParams) returnUrl.searchParams.set(key, value);
  }
  const createDate = formatVnpayDateTime(d);
  const expireDate = formatVnpayDateTime(new Date(d.getTime() + 24 * 3600e3));
  const fields: VnpayFields = {
    vnp_Version: "2.1.0", vnp_Command: "pay", vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(Math.round(input.amountVnd) * 100), vnp_CurrCode: "VND", vnp_TxnRef: input.merchantReference,
    vnp_OrderInfo: input.orderInfo, vnp_OrderType: "other", vnp_Locale: "vn", vnp_ReturnUrl: returnUrl.toString(), vnp_IpnUrl: config.ipnUrl,
    vnp_IpAddr: "127.0.0.1", vnp_CreateDate: createDate, vnp_ExpireDate: expireDate
  };
  return `${config.paymentUrl}?${sortedQuery(fields)}&vnp_SecureHash=${digest(sortedQuery(fields), config.hashSecret)}`;
}

export function verifyVnpayFields(input: Record<string, unknown>, secret: string) {
  const fields: VnpayFields = {};
  for (const [key, value] of Object.entries(input)) if (key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && typeof value === "string") fields[key] = value;
  const supplied = typeof input.vnp_SecureHash === "string" ? input.vnp_SecureHash.toLowerCase() : "";
  const expected = digest(sortedQuery(fields), secret).toLowerCase();
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function normalizeVnpayOutcome(fields: Record<string, unknown>) {
  const response = String(fields.vnp_ResponseCode ?? "");
  return { outcome: response === "00" ? "succeeded" as const : response ? "failed" as const : "pending" as const, eventKey: `return:${String(fields.vnp_TxnRef ?? "unknown")}:${String(fields.vnp_TransactionNo ?? response)}`, merchantReference: String(fields.vnp_TxnRef ?? ""), providerTransactionNo: typeof fields.vnp_TransactionNo === "string" ? fields.vnp_TransactionNo : null, amountVnd: Number(fields.vnp_Amount ?? 0) / 100 };
}

/**
 * VNPay transaction-result classification for refund execution and querydr
 * reconciliation. VNPay semantics (official sandbox API docs): vnp_ResponseCode
 * is the API REQUEST result; the transaction result is vnp_TransactionStatus
 * (00=success, 01=not complete, 02=error, 04=reversed, 05/06=refund in
 * progress, 09=refund rejected). 'succeeded' therefore requires BOTH
 * vnp_ResponseCode=00 AND vnp_TransactionStatus=00 (authoritative settlement
 * proof). A bare ResponseCode=00 with a processing status is 'pending'
 * (awaiting settlement, reconciliation will resolve it). Any terminal provider
 * error code is 'failed'. Transport/unknown states are handled by callers
 * ('ambiguous') and never reported as settlement here.
 */
export function classifyVnpayRefundOutcome(fields: Record<string, unknown>): "succeeded" | "pending" | "failed" {
  const responseCode = String(fields.vnp_ResponseCode ?? "");
  const status = String(fields.vnp_TransactionStatus ?? "");
  if (responseCode === "00") {
    if (status === "00") return "succeeded";
    if (status === "" || status === "01" || status === "05" || status === "06") return "pending";
    return "failed";
  }
  return "failed";
}

/** VNPay GMT+7 datetime string yyyyMMddHHmmss from a UTC instant. */
export function formatVnpayDateTime(value: Date): string {
  const d = new Date(value.getTime() + 7 * 3600e3);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

export function buildVnpayTransactionRequest(config: VnpayConfig, input: { requestId: string; command: "querydr" | "refund"; merchantReference: string; amountVnd: number; transactionNo?: string; transactionDate?: string; transactionType?: "02" | "03"; orderInfo: string; createdAt: Date }) {
  const d = input.createdAt;
  const createDate = formatVnpayDateTime(d);
  const fields: VnpayFields = input.command === "querydr" ? {
    vnp_RequestId: input.requestId, vnp_Version: "2.1.0", vnp_Command: "querydr", vnp_TmnCode: config.tmnCode, vnp_TxnRef: input.merchantReference,
    vnp_TransactionDate: input.transactionDate ?? createDate, vnp_CreateDate: createDate, vnp_IpAddr: "127.0.0.1", vnp_OrderInfo: input.orderInfo,
    ...(input.transactionNo ? { vnp_TransactionNo: input.transactionNo } : {})
  } : {
    vnp_RequestId: input.requestId, vnp_Version: "2.1.0", vnp_Command: "refund", vnp_TmnCode: config.tmnCode, vnp_TransactionType: input.transactionType ?? "03",
    vnp_TxnRef: input.merchantReference, vnp_Amount: String(Math.round(input.amountVnd) * 100), vnp_TransactionNo: input.transactionNo ?? "0", vnp_TransactionDate: input.transactionDate ?? createDate,
    vnp_CreateDate: createDate, vnp_CreateBy: "Tutoria", vnp_IpAddr: "127.0.0.1", vnp_OrderInfo: input.orderInfo
  };
  const query = sortedQuery(fields);
  return { fields, body: { ...fields, vnp_SecureHash: digest(query, config.hashSecret) } as VnpayFields };
}

export async function executeVnpayTransaction(
  apiUrl: string,
  request: ReturnType<typeof buildVnpayTransactionRequest>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_VNPAY_REQUEST_TIMEOUT_MS,
  shutdownSignal?: AbortSignal,
) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromShutdown = () => controller.abort();
  if (shutdownSignal?.aborted) controller.abort();
  else shutdownSignal?.addEventListener("abort", abortFromShutdown, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(apiUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request.body), signal: controller.signal });
    if (!response.ok) throw new Error(`VNPay transaction HTTP ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    if (timedOut) throw new Error(`VNPay transaction timed out after ${timeoutMs}ms`);
    if (shutdownSignal?.aborted) throw new Error("VNPay transaction aborted during worker shutdown");
    throw error;
  } finally {
    clearTimeout(timer);
    shutdownSignal?.removeEventListener("abort", abortFromShutdown);
  }
}
