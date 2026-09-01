'use strict';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRpc = vi.fn();
const mockClient = vi.fn().mockReturnValue({ rpc: mockRpc });
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient()),
}));

import { createSupabaseBookingService } from '../../src/services/booking-service';

describe('BookingService', () => {
  let service: ReturnType<typeof createSupabaseBookingService>;
  const url = 'https://test.supabase.co';
  const key = 'test-key';
  const token = 'user-token';

  beforeEach(() => {
    vi.clearAllMocks();
    service = createSupabaseBookingService(url, key);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createBooking', () => {
    it('should create a booking with valid input', async () => {
      const mockData = { bookingId: 'bk-123', status: 'pending' };
      mockRpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.createBooking(token, 'session-1', 2, 'idem-1', 'Alice', 'alice@test.com');

      expect(mockRpc).toHaveBeenCalledWith('create_booking', expect.objectContaining({
        session_id: 'session-1',
        participant_count: 2,
        p_idempotency_key: 'idem-1',
        p_learner_name: 'Alice',
        p_learner_email: 'alice@test.com',
      }), token);
      expect(result).toEqual({ data: mockData, error: null });
    });

    it('should return error when RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'ERROR', message: 'Database error' } });

      const result = await service.createBooking(token, 'session-1', 2);

      expect(result.error).toEqual({ code: 'ERROR', message: 'Database error' });
    });

    it('should handle RPC exceptions', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network failure'));

      const result = await service.createBooking(token, 'session-1', 2);

      expect(result).toEqual({ data: null, error: { message: 'Network failure' } });
    });
  });

  describe('getBooking', () => {
    it('should fetch a booking by ID for authenticated user', async () => {
      const mockBooking = { id: 'bk-123', status: 'confirmed', learnerId: 'user-1' };
      mockRpc.mockResolvedValueOnce({ data: mockBooking, error: null });

      const result = await service.getBooking(token, 'bk-123');

      expect(mockRpc).toHaveBeenCalledWith('get_booking', { bid: 'bk-123' }, token);
      expect(result).toEqual({ data: mockBooking, error: null });
    });

    it('should return error for non-existent booking', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND', message: 'Booking not found' } });

      const result = await service.getBooking(token, 'nonexistent');

      expect(result.error).toEqual({ code: 'NOT_FOUND', message: 'Booking not found' });
    });
  });

  describe('listLearnerBookings', () => {
    it('should list bookings for the authenticated learner', async () => {
      const mockBookings = [{ id: 'bk-1' }, { id: 'bk-2' }];
      mockRpc.mockResolvedValueOnce({ data: mockBookings, error: null });

      const result = await service.listLearnerBookings(token);

      expect(mockRpc).toHaveBeenCalledWith('get_my_bookings', {}, token);
      expect(result).toEqual({ data: mockBookings, error: null });
    });
  });

  describe('listHostBookings', () => {
    it('should list host bookings for authenticated user', async () => {
      const mockBookings = [{ id: 'bk-1', role: 'host' }];
      mockRpc.mockResolvedValueOnce({ data: mockBookings, error: null });

      const result = await service.listHostBookings(token);

      expect(mockRpc).toHaveBeenCalledWith('get_my_host_bookings', {}, token);
      expect(result).toEqual({ data: mockBookings, error: null });
    });
  });

  describe('listTutorBookings', () => {
    it('should list tutor bookings for authenticated user', async () => {
      const mockBookings = [{ id: 'bk-1', role: 'tutor' }];
      mockRpc.mockResolvedValueOnce({ data: mockBookings, error: null });

      const result = await service.listTutorBookings(token);

      expect(mockRpc).toHaveBeenCalledWith('get_my_tutor_bookings', {}, token);
      expect(result).toEqual({ data: mockBookings, error: null });
    });
  });

  describe('tutorAccept', () => {
    it('should accept a booking for payment', async () => {
      const mockData = { id: 'bk-123', status: 'awaiting_payment' };
      mockRpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.tutorAccept(token, 'bk-123');

      expect(mockRpc).toHaveBeenCalledWith('approve_booking_for_payment', { p_booking_id: 'bk-123' }, token);
      expect(result).toEqual({ data: mockData, error: null });
    });
  });

  describe('tutorReject', () => {
    it('should reject a booking with expected version', async () => {
      mockRpc.mockResolvedValueOnce({ data: { id: 'bk-123', status: 'rejected' }, error: null });

      const result = await service.tutorReject(token, 'bk-123', 1);

      expect(mockRpc).toHaveBeenCalledWith('reject_booking', { booking_id: 'bk-123', expected_version: 1 }, token);
      expect(result.error).toBeNull();
    });

    it('should handle version conflict rejection', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'CONFLICT', message: 'Version mismatch' } });

      const result = await service.tutorReject(token, 'bk-123', 99);

      expect(result.error).toEqual({ code: 'CONFLICT', message: 'Version mismatch' });
    });
  });

  describe('tutorCancel', () => {
    it('should cancel booking as host with reason', async () => {
      mockRpc.mockResolvedValueOnce({ data: { id: 'bk-123', status: 'cancelled' }, error: null });

      const result = await service.tutorCancel(token, 'bk-123', 1, 'Tutor unavailable');

      expect(mockRpc).toHaveBeenCalledWith('cancel_booking', {
        booking_id: 'bk-123',
        expected_version: 1,
        cause: 'host',
        reason: 'Tutor unavailable',
      }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('learnerCancel', () => {
    it('should cancel booking as attendee with reason', async () => {
      mockRpc.mockResolvedValueOnce({ data: { id: 'bk-123', status: 'cancelled' }, error: null });

      const result = await service.learnerCancel(token, 'bk-123', 1, 'Schedule conflict');

      expect(mockRpc).toHaveBeenCalledWith('cancel_booking', {
        booking_id: 'bk-123',
        expected_version: 1,
        cause: 'attendee',
        reason: 'Schedule conflict',
      }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('getCancellationPreview', () => {
    it('should return cancellation preview with refund info', async () => {
      const preview = { refundAmount: 150000, policy: 'full_refund' };
      mockRpc.mockResolvedValueOnce({ data: preview, error: null });

      const result = await service.getCancellationPreview(token, 'bk-123');

      expect(mockRpc).toHaveBeenCalledWith('get_booking_cancellation_preview', { bid: 'bk-123' }, token);
      expect(result).toEqual({ data: preview, error: null });
    });
  });

  describe('createRescheduleRequest', () => {
    it('should create a reschedule request', async () => {
      const mockData = { requestId: 'req-1', status: 'pending' };
      mockRpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.createRescheduleRequest(token, 'bk-123', 'session-2', 1, 'Need different time');

      expect(mockRpc).toHaveBeenCalledWith('create_reschedule_request', {
        booking_id: 'bk-123',
        target_session_id: 'session-2',
        expected_version: 1,
        reason: 'Need different time',
      }, token);
      expect(result).toEqual({ data: mockData, error: null });
    });
  });

  describe('acceptReschedule', () => {
    it('should accept a reschedule request', async () => {
      mockRpc.mockResolvedValueOnce({ data: { requestId: 'req-1', status: 'accepted' }, error: null });

      const result = await service.acceptReschedule(token, 'req-1');

      expect(mockRpc).toHaveBeenCalledWith('accept_reschedule_request', { request_id: 'req-1' }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('rejectReschedule', () => {
    it('should reject a reschedule request', async () => {
      mockRpc.mockResolvedValueOnce({ data: { requestId: 'req-1', status: 'rejected' }, error: null });

      const result = await service.rejectReschedule(token, 'req-1');

      expect(mockRpc).toHaveBeenCalledWith('reject_reschedule_request', { request_id: 'req-1' }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('cancelReschedule', () => {
    it('should cancel a reschedule request', async () => {
      mockRpc.mockResolvedValueOnce({ data: { requestId: 'req-1', status: 'cancelled' }, error: null });

      const result = await service.cancelReschedule(token, 'req-1');

      expect(mockRpc).toHaveBeenCalledWith('cancel_reschedule_request', { request_id: 'req-1' }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('cancelSession', () => {
    it('should cancel a session as host', async () => {
      mockRpc.mockResolvedValueOnce({ data: { sessionId: 'sess-1', status: 'cancelled' }, error: null });

      const result = await service.cancelSession(token, 'sess-1', 1, 'Session cancelled by host');

      expect(mockRpc).toHaveBeenCalledWith('cancel_session', {
        sid: 'sess-1',
        expected_version: 1,
        cause: 'host',
        reason: 'Session cancelled by host',
      }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('rescheduleSession', () => {
    it('should reschedule a session with new times', async () => {
      mockRpc.mockResolvedValueOnce({ data: { sessionId: 'sess-1', startsAt: '2026-09-15T10:00:00Z', endsAt: '2026-09-15T11:00:00Z' }, error: null });

      const result = await service.rescheduleSession(token, 'sess-1', '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z', 1);

      expect(mockRpc).toHaveBeenCalledWith('reschedule_session', {
        sid: 'sess-1',
        starts_at: '2026-09-15T10:00:00Z',
        ends_at: '2026-09-15T11:00:00Z',
        expected_version: 1,
      }, token);
      expect(result.error).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should list sessions without filters', async () => {
      const mockSessions = [{ id: 'sess-1' }, { id: 'sess-2' }];
      mockRpc.mockResolvedValueOnce({ data: mockSessions, error: null });

      const result = await service.listSessions();

      expect(mockRpc).toHaveBeenCalledWith('list_bookable_sessions', {
        p_tutor_profile_id: null,
        p_offering_id: null,
        p_kind: null,
      });
      expect(result).toEqual({ data: mockSessions, error: null });
    });

    it('should list sessions filtered by tutor profile', async () => {
      const mockSessions = [{ id: 'sess-1', tutorProfileId: 'tp-1' }];
      mockRpc.mockResolvedValueOnce({ data: mockSessions, error: null });

      const result = await service.listSessions('tp-1');

      expect(mockRpc).toHaveBeenCalledWith('list_bookable_sessions', {
        p_tutor_profile_id: 'tp-1',
        p_offering_id: null,
        p_kind: null,
      });
      expect(result).toEqual({ data: mockSessions, error: null });
    });

    it('should list sessions filtered by offering', async () => {
      const mockSessions = [{ id: 'sess-1', offeringId: 'off-1' }];
      mockRpc.mockResolvedValueOnce({ data: mockSessions, error: null });

      const result = await service.listSessions(undefined, 'off-1');

      expect(mockRpc).toHaveBeenCalledWith('list_bookable_sessions', {
        p_tutor_profile_id: null,
        p_offering_id: 'off-1',
        p_kind: null,
      });
      expect(result).toEqual({ data: mockSessions, error: null });
    });
  });

  describe('getSession', () => {
    it('should get a single session by ID', async () => {
      const mockSession = { id: 'sess-1', title: 'Math Tutoring' };
      mockRpc.mockResolvedValueOnce({ data: mockSession, error: null });

      const result = await service.getSession('sess-1');

      expect(mockRpc).toHaveBeenCalledWith('get_bookable_session', { p_session_id: 'sess-1' });
      expect(result).toEqual({ data: mockSession, error: null });
    });
  });

  describe('offering operations', () => {
    describe('getOffering', () => {
      it('should get an offering by ID', async () => {
        const mockOffering = { id: 'off-1', title: 'Spanish Lesson' };
        mockRpc.mockResolvedValueOnce({ data: mockOffering, error: null });

        const result = await service.getOffering('off-1');

        expect(mockRpc).toHaveBeenCalledWith('get_offering', { p_offering_id: 'off-1' });
        expect(result).toEqual({ data: mockOffering, error: null });
      });
    });

    describe('listSessionsByOffering', () => {
      it('should list sessions for an offering', async () => {
        const mockSessions = [{ id: 'sess-1' }, { id: 'sess-2' }];
        mockRpc.mockResolvedValueOnce({ data: mockSessions, error: null });

        const result = await service.listSessionsByOffering('off-1');

        expect(mockRpc).toHaveBeenCalledWith('list_sessions_by_offering_id', { p_offering_id: 'off-1' });
        expect(result).toEqual({ data: mockSessions, error: null });
      });
    });

    describe('createOffering', () => {
      it('should create an offering with required params', async () => {
        const mockOffering = { id: 'off-new', title: 'Guitar Lesson' };
        mockRpc.mockResolvedValueOnce({ data: mockOffering, error: null });

        const result = await service.createOffering(token, {
          offeringType: '1-on-1',
          title: 'Guitar Lesson',
          pricingModel: 'hourly',
          hourlyRateVnd: 150000,
        });

        expect(mockRpc).toHaveBeenCalledWith('create_offering', expect.objectContaining({
          p_offering_type: '1-on-1',
          p_title: 'Guitar Lesson',
          p_pricing_model: 'hourly',
          p_hourly_rate_vnd: 150000,
        }), token);
        expect(result).toEqual({ data: mockOffering, error: null });
      });

      it('should create offering with all optional params', async () => {
        const mockOffering = { id: 'off-new' };
        mockRpc.mockResolvedValueOnce({ data: mockOffering, error: null });

        const result = await service.createOffering(token, {
          offeringType: 'group',
          title: 'Group Workshop',
          pricingModel: 'per_participant',
          pricePerParticipantVnd: 50000,
          bookingMode: 'instant',
          description: 'Learn together',
        });

        expect(mockRpc).toHaveBeenCalledWith('create_offering', expect.objectContaining({
          p_offering_type: 'group',
          p_title: 'Group Workshop',
          p_pricing_model: 'per_participant',
          p_price_per_participant_vnd: 50000,
          p_booking_mode: 'instant',
          p_description: 'Learn together',
        }), token);
        expect(result.error).toBeNull();
      });
    });

    describe('updateOfferingStatus', () => {
      it('should update offering status', async () => {
        mockRpc.mockResolvedValueOnce({ data: { id: 'off-1', status: 'active' }, error: null });

        const result = await service.updateOfferingStatus(token, 'off-1', 1, 'active');

        expect(mockRpc).toHaveBeenCalledWith('update_offering_status', {
          p_offering_id: 'off-1',
          p_expected_version: 1,
          p_status: 'active',
        }, token);
        expect(result.error).toBeNull();
      });
    });
  });

  describe('workshop booking operations', () => {
    describe('listWorkshopBookings', () => {
      it('should list workshop bookings', async () => {
        const mockBookings = [{ id: 'wb-1', type: 'workshop' }];
        mockRpc.mockResolvedValueOnce({ data: mockBookings, error: null });

        const result = await service.listWorkshopBookings(token);

        expect(mockRpc).toHaveBeenCalledWith('get_my_workshop_bookings', {}, token);
        expect(result).toEqual({ data: mockBookings, error: null });
      });
    });

    describe('cancelWorkshopBooking', () => {
      it('should cancel a workshop booking with reason', async () => {
        mockRpc.mockResolvedValueOnce({ data: { id: 'wb-1', status: 'cancelled' }, error: null });

        const result = await service.cancelWorkshopBooking(token, 'wb-1', 1, 'Workshop cancelled');

        expect(mockRpc).toHaveBeenCalledWith('cancel_workshop_booking', {
          p_booking_id: 'wb-1',
          p_expected_version: 1,
          p_reason: 'Workshop cancelled',
        }, token);
        expect(result.error).toBeNull();
      });
    });
  });

  describe('error handling', () => {
    it('should return service unavailable on RPC exception', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await service.listSessions();

      expect(result).toEqual({ data: null, error: { message: 'Connection timeout' } });
    });

    it('should propagate error codes from Supabase', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST204', message: 'Not found' } });

      const result = await service.getBooking(token, 'nonexistent');

      expect(result.error).toEqual({ code: 'PGRST204', message: 'Not found' });
    });
  });
});
