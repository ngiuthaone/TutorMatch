'use strict';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockTrustedRpc = vi.fn();
const mockCallerRpc = vi.fn();
const mockTrustedFrom = vi.fn();
const mockCallerFrom = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

const mockTrustedClient = {
  rpc: mockTrustedRpc,
  from: vi.fn().mockReturnValue({
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  }),
};

const mockCallerClient = {
  rpc: mockCallerRpc,
  from: vi.fn().mockReturnValue({
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  }),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key) => {
    if (key === 'service-role-key') return mockTrustedClient;
    return mockCallerClient;
  }),
}));

vi.mock('../../src/services/vnpay-adapter.js', () => ({
  buildVnpayPaymentUrl: vi.fn(() => 'https://vnpay.test/pay?mock'),
  buildVnpayTransactionRequest: vi.fn(() => ({ body: { vnp_ResponseCode: '00' } })),
  executeVnpayTransaction: vi.fn(() => Promise.resolve({ vnp_ResponseCode: '00', vnp_TransactionNo: '12345' })),
  normalizeVnpayOutcome: vi.fn(() => ({ outcome: 'succeeded', eventKey: 'test', merchantReference: 'ref-1', providerTransactionNo: '12345', amountVnd: 100000 })),
  classifyVnpayRefundOutcome: vi.fn(() => 'succeeded'),
  formatVnpayDateTime: vi.fn(() => '20260901120000'),
}));

import { createSupabasePaymentService } from '../../src/services/payment-service';

describe('PaymentService', () => {
  let service: ReturnType<typeof createSupabasePaymentService>;
  const url = 'https://test.supabase.co';
  const pubKey = 'publishable-key';
  const serviceKey = 'service-role-key';
  const token = 'user-token';

  const vnpayConfig = {
    tmnCode: 'TESTTMN',
    hashSecret: 'test-secret',
    paymentUrl: 'https://vnpay.test',
    returnUrl: 'https://app.tutoria.com/payment/return',
    ipnUrl: 'https://app.tutoria.com/api/v1/payments/ipn',
  };
  const vnpayApiUrl = 'https://vnpayapi.test';

  beforeEach(() => {
    vi.clearAllMocks();
    service = createSupabasePaymentService(url, pubKey, serviceKey, vnpayConfig, vnpayApiUrl);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('start', () => {
    it('should start a payment attempt and return redirect URL', async () => {
      const mockData = { merchantReference: 'ref-123', amountVnd: 150000 };
      mockCallerRpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.start(token, 'bk-123', 'idem-1');

      expect(mockCallerRpc).toHaveBeenCalledWith('start_payment_attempt', {
        p_booking_id: 'bk-123',
        p_idempotency_key: 'idem-1',
      });
      expect(result.data).toMatchObject({
        merchantReference: 'ref-123',
        amountVnd: 150000,
        redirectUrl: expect.stringContaining('vnpay.test'),
      });
      expect(result.error).toBeNull();
    });

    it('should return error when RPC fails', async () => {
      mockCallerRpc.mockResolvedValueOnce({ data: null, error: { message: 'Booking not found' } });

      const result = await service.start(token, 'invalid-bk', 'idem-1');

      expect(result.error).toEqual({ message: 'Booking not found' });
    });

    it('should return error when response data is invalid', async () => {
      mockCallerRpc.mockResolvedValueOnce({ data: { merchantReference: null }, error: null });

      const result = await service.start(token, 'bk-123', 'idem-1');

      expect(result.error).toMatchObject({ code: 'INVALID_RESPONSE' });
    });
  });

  describe('read', () => {
    it('should read payment for a booking', async () => {
      const mockData = { id: 'pay-1', status: 'succeeded', amountVnd: 150000 };
      mockCallerRpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.read(token, 'bk-123');

      expect(mockCallerRpc).toHaveBeenCalledWith('get_booking_payment', { p_booking_id: 'bk-123' });
      expect(result).toEqual({ data: mockData, error: null });
    });

    it('should return error when payment not found', async () => {
      mockCallerRpc.mockResolvedValueOnce({ data: null, error: { message: 'No payment found' } });

      const result = await service.read(token, 'bk-123');

      expect(result.error).toEqual({ message: 'No payment found' });
    });
  });

  describe('observe', () => {
    it('should record a payment observation and finalize if succeeded', async () => {
      const mockData = { status: 'succeeded', bookingId: 'bk-123' };
      mockTrustedRpc.mockResolvedValueOnce({ data: mockData, error: null });
      mockTrustedRpc.mockResolvedValueOnce({ data: { id: 'bk-123' }, error: null });

      const result = await service.observe({
        eventKey: 'return:ref-1:12345',
        merchantReference: 'ref-1',
        outcome: 'succeeded',
        providerTransactionNo: '12345',
        amountVnd: 150000,
        payload: { vnp_ResponseCode: '00' },
      });

      expect(mockTrustedRpc).toHaveBeenCalledWith('record_vnpay_observation', expect.any(Object));
      expect(result.data).toEqual(mockData);
    });

    it('should return error when service role is not configured', async () => {
      const serviceNoRole = createSupabasePaymentService(url, pubKey, undefined as any, vnpayConfig, vnpayApiUrl);

      const result = await serviceNoRole.observe({
        eventKey: 'test',
        merchantReference: 'ref-1',
        outcome: 'succeeded',
        providerTransactionNo: '12345',
        amountVnd: 150000,
        payload: {},
      });

      expect(result.error).toMatchObject({ message: 'Payment service authority is not configured' });
    });
  });

  describe('reconcile', () => {
    it('should reconcile a payment and record observation', async () => {
      const attemptData = { id: 'att-1', payment_id: 'pay-1', amount_vnd: 150000, merchant_reference: 'ref-1' };
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: attemptData, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockTrustedRpc.mockResolvedValueOnce({ data: null, error: null });
      mockTrustedRpc.mockResolvedValueOnce({ data: { status: 'succeeded' }, error: null });

      const result = await service.reconcile('ref-1');

      expect(result.error).toBeNull();
    });

    it('should return error when payment attempt not found', async () => {
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await service.reconcile('nonexistent-ref');

      expect(result.error).toMatchObject({ message: 'Unknown provider reference' });
    });

    it('should return cached result if reconciliation already succeeded', async () => {
      const cachedPayload = { vnp_ResponseCode: '00' };
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'att-1', payment_id: 'pay-1', amount_vnd: 150000, merchant_reference: 'ref-1' }, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'succeeded', response_payload: cachedPayload }, error: null }),
      });

      const result = await service.reconcile('ref-1');

      expect(result.data).toEqual(cachedPayload);
    });
  });

  describe('executeRefund', () => {
    it('should execute a pending refund', async () => {
      const refundData = { id: 'ref-1', payment_id: 'pay-1', amount_vnd: 50000, status: 'pending', provider_transaction_no: 'txn-123' };
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: refundData, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { amount_vnd: 150000, status: 'succeeded' }, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { merchant_reference: 'ref-1', provider_transaction_no: 'txn-123' }, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      mockTrustedRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.executeRefund('ref-1');

      expect(result.error).toBeNull();
    });

    it('should return immediately if refund already succeeded', async () => {
      const refundData = { id: 'ref-1', status: 'succeeded' };
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: refundData, error: null }),
      });

      const result = await service.executeRefund('ref-1');

      expect(result.data).toEqual(refundData);
      expect(result.error).toBeNull();
    });

    it('should return error for terminal failed refund', async () => {
      const refundData = { id: 'ref-1', status: 'failed' };
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: refundData, error: null }),
      });

      const result = await service.executeRefund('ref-1');

      expect(result.error).toMatchObject({ message: expect.stringContaining('terminal') });
    });

    it('should return error when refund not found', async () => {
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await service.executeRefund('nonexistent');

      expect(result.error).toMatchObject({ message: 'Unknown refund obligation' });
    });
  });

  describe('reconcileRefund', () => {
    it('should reconcile a pending refund', async () => {
      const refundData = { id: 'ref-1', payment_id: 'pay-1', amount_vnd: 50000, status: 'pending', provider_transaction_no: 'txn-123' };
      const opData = { provider_request_id: 'req-123', created_at: new Date().toISOString() };
      const attemptData = { id: 'att-1', merchant_reference: 'ref-1' };

      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: refundData, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: opData, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: attemptData, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockTrustedFrom.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      mockTrustedRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.reconcileRefund('ref-1');

      expect(result.error).toBeNull();
    });

    it('should return immediately if refund already succeeded', async () => {
      mockTrustedFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ref-1', status: 'succeeded' }, error: null }),
      });

      const result = await service.reconcileRefund('ref-1');

      expect(result.data).toMatchObject({ status: 'succeeded' });
    });
  });

  describe('sweepRefundExecutions', () => {
    it('should claim and execute pending refunds', async () => {
      const claimedRows = [{ refundId: 'ref-1' }, { refundId: 'ref-2' }];
      mockTrustedRpc.mockResolvedValueOnce({ data: claimedRows, error: null });
      mockTrustedFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockTrustedRpc.mockResolvedValue({ data: { id: 'refund-result' }, error: null });

      const result = await service.sweepRefundExecutions('worker-1');

      expect(result.data).toMatchObject({ claimed: 2, executed: expect.any(Number) });
      expect(result.error).toBeNull();
    });

    it('should return early if signal is aborted', async () => {
      const abortedService = createSupabasePaymentService(url, pubKey, serviceKey, vnpayConfig, vnpayApiUrl, fetch, { signal: { aborted: true } } as any);

      const result = await abortedService.sweepRefundExecutions('worker-1');

      expect(result.data).toEqual({ claimed: 0, executed: 0 });
    });
  });

  describe('sweepRefundReconciliations', () => {
    it('should claim and reconcile pending refunds', async () => {
      const claimedRows = [{ refundId: 'ref-1' }];
      mockTrustedRpc.mockResolvedValueOnce({ data: claimedRows, error: null });
      mockTrustedFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'succeeded' }, error: null }),
      });
      mockTrustedRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.sweepRefundReconciliations('worker-1');

      expect(result.data).toMatchObject({ claimed: 1, reconciled: expect.any(Number) });
    });
  });

  describe('sweepPendingFinalizations', () => {
    it('should claim and finalize pending payments', async () => {
      const claimedEvents = [{ id: 'evt-1', payload: { bookingId: 'bk-123' }, attemptCount: 1 }];
      mockTrustedRpc.mockResolvedValueOnce({ data: claimedEvents, error: null });
      mockTrustedRpc.mockResolvedValue({ data: { id: 'bk-123', status: 'confirmed' }, error: null });
      mockTrustedRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.sweepPendingFinalizations('worker-1');

      expect(result.data).toMatchObject({ claimed: 1, finalized: expect.any(Number) });
    });

    it('should handle finalization failure with backoff', async () => {
      const claimedEvents = [{ id: 'evt-1', payload: { bookingId: 'bk-123' }, attemptCount: 5 }];
      mockTrustedRpc.mockResolvedValueOnce({ data: claimedEvents, error: null });
      mockTrustedRpc.mockResolvedValueOnce({ data: null, error: { message: 'Finalization failed' } });
      mockTrustedRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.sweepPendingFinalizations('worker-1');

      expect(mockTrustedRpc).toHaveBeenCalledWith('fail_event', expect.objectContaining({
        p_backoff_seconds: 86400,
      }));
    });
  });

  describe('sweepExpiredWorkshopBookings', () => {
    it('should expire stale workshop bookings', async () => {
      const mockResult = { expired: 3 };
      mockTrustedRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await service.sweepExpiredWorkshopBookings('worker-1');

      expect(mockTrustedRpc).toHaveBeenCalledWith('expire_stale_workshop_bookings', { p_worker_id: 'worker-1' });
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('authority check', () => {
    it('should return error for all operations when service role key is missing', async () => {
      const serviceNoRole = createSupabasePaymentService(url, pubKey, undefined as any, vnpayConfig, vnpayApiUrl);

      const startResult = await serviceNoRole.start(token, 'bk-123', 'idem');
      const observeResult = await serviceNoRole.observe({ eventKey: 't', merchantReference: 'r', outcome: 'succeeded', providerTransactionNo: '1', amountVnd: 100, payload: {} });
      const reconcileResult = await serviceNoRole.reconcile('ref');
      const execRefundResult = await serviceNoRole.executeRefund('ref');
      const sweepResult = await serviceNoRole.sweepRefundExecutions('w');

      expect(startResult.error).toBeNull();
      expect(observeResult.error).toMatchObject({ message: 'Payment service authority is not configured' });
      expect(reconcileResult.error).toMatchObject({ message: 'Payment service authority is not configured' });
      expect(execRefundResult.error).toMatchObject({ message: 'Payment service authority is not configured' });
      expect(sweepResult.error).toMatchObject({ message: 'Payment service authority is not configured' });
    });
  });
});
