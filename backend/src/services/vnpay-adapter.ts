import { createHmac, timingSafeEqual } from "node:crypto";

export type VnpayConfig = { tmnCode: string; hashSecret: string; paymentUrl: string; returnUrl: string; ipnUrl: string };
export type VnpayFields = Record<string, string>;

function sortedQuery(fields: VnpayFields) {
  return Object.keys(fields).filter((key) => fields[key] !== "" && fields[key] !== undefined).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key] ?? "")}`).join("&");
}
function digest(value: string, secret: string) { return createHmac("sha512", secret).update(value, "utf8").digest("hex"); }

export function buildVnpayPaymentUrl(config: VnpayConfig, input: { merchantReference: string; amountVnd: number; orderInfo: string; createdAt: Date; returnUrl?: string }) {
  const d = input.createdAt;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fields: VnpayFields = {
    vnp_Version: "2.1.0", vnp_Command: "pay", vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(Math.round(input.amountVnd) * 100), vnp_CurrCode: "VND", vnp_TxnRef: input.merchantReference,
    vnp_OrderInfo: input.orderInfo, vnp_OrderType: "other", vnp_Locale: "vn", vnp_ReturnUrl: input.returnUrl ?? config.returnUrl, vnp_IpnUrl: config.ipnUrl,
    vnp_IpAddr: "127.0.0.1", vnp_CreateDate: `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
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

export function buildVnpayTransactionRequest(config: VnpayConfig, input: { requestId: string; command: "querydr" | "refund"; merchantReference: string; amountVnd: number; transactionNo?: string; transactionDate?: string; transactionType?: "02" | "03"; orderInfo: string; createdAt: Date }) {
  const d = input.createdAt;
  const pad = (n: number) => String(n).padStart(2, "0");
  const createDate = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const fields: VnpayFields = input.command === "querydr" ? {
    vnp_RequestId: input.requestId, vnp_Version: "2.1.0", vnp_Command: "querydr", vnp_TmnCode: config.tmnCode, vnp_TxnRef: input.merchantReference,
    vnp_TransactionDate: input.transactionDate ?? createDate, vnp_CreateDate: createDate, vnp_IpAddr: "127.0.0.1", vnp_OrderInfo: input.orderInfo
  } : {
    vnp_RequestId: input.requestId, vnp_Version: "2.1.0", vnp_Command: "refund", vnp_TmnCode: config.tmnCode, vnp_TransactionType: input.transactionType ?? "03",
    vnp_TxnRef: input.merchantReference, vnp_Amount: String(Math.round(input.amountVnd) * 100), vnp_TransactionNo: input.transactionNo ?? "0", vnp_TransactionDate: input.transactionDate ?? createDate,
    vnp_CreateDate: createDate, vnp_CreateBy: "Tutoria", vnp_IpAddr: "127.0.0.1", vnp_OrderInfo: input.orderInfo
  };
  const query = sortedQuery(fields);
  return { fields, body: { ...fields, vnp_SecureHash: digest(query, config.hashSecret) } as VnpayFields };
}

export async function executeVnpayTransaction(apiUrl: string, request: ReturnType<typeof buildVnpayTransactionRequest>, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(apiUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request.body) });
  if (!response.ok) throw new Error(`VNPay transaction HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}
