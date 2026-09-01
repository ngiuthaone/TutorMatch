'use strict';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRpc = vi.fn();
const mockClient = vi.fn().mockReturnValue({ rpc: mockRpc });
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient()),
}));

import { createSupabaseMessagingService, type MessagingConversation, type MessagingMessage } from '../../src/services/messaging-service';

describe('MessagingService', () => {
  let service: ReturnType<typeof createSupabaseMessagingService>;
  const url = 'https://test.supabase.co';
  const key = 'test-key';
  const token = 'user-token';

  const mockConversation: MessagingConversation = {
    id: 'conv-1',
    bookingId: 'bk-123',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T12:00:00Z',
    lastMessageAt: '2026-09-01T12:00:00Z',
    lastMessagePreview: 'Hello!',
    unreadCount: 2,
    viewerRole: 'learner',
    participant: { userId: 'user-2', role: 'host', displayName: 'Tutor Alice' },
    bookingContext: {
      bookingId: 'bk-123',
      sessionId: 'sess-1',
      sessionStartsAt: '2026-09-15T10:00:00Z',
      sessionEndsAt: '2026-09-15T11:00:00Z',
      bookingStatus: 'confirmed',
    },
    lastMessage: {
      id: 'msg-1',
      senderId: 'user-2',
      body: 'Hello!',
      createdAt: '2026-09-01T12:00:00Z',
      moderationStatus: 'approved',
    },
  };

  const mockMessage: MessagingMessage = {
    id: 'msg-1',
    senderId: 'user-1',
    mine: true,
    body: 'Hello, I have a question about the lesson.',
    createdAt: '2026-09-01T12:00:00Z',
    moderationStatus: 'approved',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = createSupabaseMessagingService(url, key);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listConversations', () => {
    it('should list all conversations for the authenticated user', async () => {
      const conversations = [mockConversation];
      mockRpc.mockResolvedValueOnce({ data: conversations, error: null });

      const result = await service.listConversations(token);

      expect(mockRpc).toHaveBeenCalledWith(token, 'list_my_conversations', {});
      expect(result).toEqual({ status: 'ok', data: conversations });
    });

    it('should return unavailable when RPC throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.listConversations(token);

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('should return unavailable when RPC returns error', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Service error' } });

      const result = await service.listConversations(token);

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('getConversation', () => {
    it('should get a conversation by ID', async () => {
      mockRpc.mockResolvedValueOnce({ data: mockConversation, error: null });

      const result = await service.getConversation(token, 'conv-1');

      expect(mockRpc).toHaveBeenCalledWith(token, 'get_conversation', { cid: 'conv-1' });
      expect(result).toEqual({ status: 'ok', data: mockConversation });
    });

    it('should return not_found when conversation does not exist', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.getConversation(token, 'nonexistent');

      expect(result).toEqual({ status: 'not_found' });
    });

    it('should return unavailable when RPC throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await service.getConversation(token, 'conv-1');

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('getOrCreateBookingConversation', () => {
    it('should get or create a conversation for a booking', async () => {
      mockRpc.mockResolvedValueOnce({ data: mockConversation, error: null });

      const result = await service.getOrCreateBookingConversation(token, 'bk-123');

      expect(mockRpc).toHaveBeenCalledWith(token, 'get_or_create_booking_conversation', { p_booking_id: 'bk-123' });
      expect(result).toEqual({ status: 'ok', data: mockConversation });
    });

    it('should return forbidden when user lacks permission', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'insufficient_privilege' } });

      const result = await service.getOrCreateBookingConversation(token, 'bk-123');

      expect(result).toEqual({ status: 'forbidden' });
    });

    it('should return forbidden when error message contains forbidden', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'Forbidden: access denied' } });

      const result = await service.getOrCreateBookingConversation(token, 'bk-123');

      expect(result).toEqual({ status: 'forbidden' });
    });

    it('should return not_found when no data returned', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.getOrCreateBookingConversation(token, 'bk-123');

      expect(result).toEqual({ status: 'not_found' });
    });

    it('should return unavailable when RPC throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getOrCreateBookingConversation(token, 'bk-123');

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('listMessages', () => {
    it('should list messages for a conversation with default limit', async () => {
      const messages = [mockMessage];
      mockRpc.mockResolvedValueOnce({ data: messages, error: null });

      const result = await service.listMessages(token, 'conv-1', 100);

      expect(mockRpc).toHaveBeenCalledWith(token, 'list_conversation_messages', { cid: 'conv-1', p_limit: 100 });
      expect(result).toEqual({ status: 'ok', data: messages });
    });

    it('should list messages with before cursor', async () => {
      const messages = [mockMessage];
      mockRpc.mockResolvedValueOnce({ data: messages, error: null });

      const result = await service.listMessages(token, 'conv-1', 50, '2026-09-01T11:00:00Z');

      expect(mockRpc).toHaveBeenCalledWith(token, 'list_conversation_messages', {
        cid: 'conv-1',
        p_limit: 50,
        p_before: '2026-09-01T11:00:00Z',
      });
      expect(result).toEqual({ status: 'ok', data: messages });
    });

    it('should return empty array when no messages', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.listMessages(token, 'conv-1');

      expect(result).toEqual({ status: 'ok', data: [] });
    });

    it('should return forbidden when user is not a member', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'insufficient_privilege' } });

      const result = await service.listMessages(token, 'conv-1');

      expect(result).toEqual({ status: 'forbidden' });
    });

    it('should return unavailable when RPC throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await service.listMessages(token, 'conv-1');

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const messageWithDuplicate = { ...mockMessage, duplicate: false };
      mockRpc.mockResolvedValueOnce({ data: messageWithDuplicate, error: null });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(mockRpc).toHaveBeenCalledWith(token, 'send_message', {
        cid: 'conv-1',
        p_client_message_id: 'client-msg-123',
        p_body: 'Hello!',
      });
      expect(result).toEqual({ status: 'ok', data: messageWithDuplicate, duplicate: false });
    });

    it('should detect duplicate message from idempotency', async () => {
      const duplicateMessage = { ...mockMessage, duplicate: true };
      mockRpc.mockResolvedValueOnce({ data: duplicateMessage, error: null });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(result).toEqual({ status: 'ok', data: duplicateMessage, duplicate: true });
    });

    it('should return forbidden when user is not a member', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'insufficient_privilege' } });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(result).toEqual({ status: 'forbidden' });
    });

    it('should return invalid for idempotency conflict', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'IDEMPOTENCY_CONFLICT' } });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(result).toEqual({ status: 'invalid' });
    });

    it('should return invalid for INVALID_MESSAGE error', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '400', message: 'INVALID_MESSAGE' } });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(result).toEqual({ status: 'invalid' });
    });

    it('should return unavailable when RPC throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('should return unavailable when RPC returns no data', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg-123', 'Hello!');

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('markRead', () => {
    it('should mark conversation as read', async () => {
      const readResult = { conversationId: 'conv-1', lastReadAt: '2026-09-01T12:30:00Z' };
      mockRpc.mockResolvedValueOnce({ data: readResult, error: null });

      const result = await service.markRead(token, 'conv-1');

      expect(mockRpc).toHaveBeenCalledWith(token, 'mark_conversation_read', { cid: 'conv-1' });
      expect(result).toEqual({ status: 'ok', data: readResult });
    });

    it('should return forbidden when user is not a member', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'insufficient_privilege' } });

      const result = await service.markRead(token, 'conv-1');

      expect(result).toEqual({ status: 'forbidden' });
    });

    it('should return unavailable when RPC throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await service.markRead(token, 'conv-1');

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('error classification', () => {
    it('should classify forbidden error by code 42501', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'some privilege error' } });

      const sendResult = await service.sendMessage(token, 'conv-1', 'client-msg', 'test');
      expect(sendResult).toEqual({ status: 'forbidden' });

      const listResult = await service.listMessages(token, 'conv-1');
      expect(listResult).toEqual({ status: 'forbidden' });

      const markResult = await service.markRead(token, 'conv-1');
      expect(markResult).toEqual({ status: 'forbidden' });
    });

    it('should classify invalid error by code 22023', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'parameter violation' } });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg', 'test');

      expect(result).toEqual({ status: 'invalid' });
    });

    it('should classify invalid error by IDEMPOTENCY_CONFLICT message', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'IDEMPOTENCY_CONFLICT detected' } });

      const result = await service.sendMessage(token, 'conv-1', 'client-msg', 'test');

      expect(result).toEqual({ status: 'invalid' });
    });

    it('should treat unknown errors as unavailable', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'Internal server error' } });

      const result = await service.listConversations(token);

      expect(result).toEqual({ status: 'unavailable' });
    });
  });

  describe('RPC exception handling', () => {
    it('should return unavailable when RPC rejects for listConversations', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Connection reset'));

      const result = await service.listConversations(token);

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('should return unavailable when RPC rejects for getConversation', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.getConversation(token, 'conv-1');

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('should return unavailable when RPC rejects for listMessages', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network unreachable'));

      const result = await service.listMessages(token, 'conv-1');

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('should return unavailable when RPC rejects for sendMessage', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await service.sendMessage(token, 'conv-1', 'client-msg', 'test');

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('should return unavailable when RPC rejects for markRead', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.markRead(token, 'conv-1');

      expect(result).toEqual({ status: 'unavailable' });
    });
  });
});
