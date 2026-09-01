import { createClient } from "@supabase/supabase-js";
import { logServiceError } from "../lib/service-error.js";

export interface AdminAuditEntry {
  id: number;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason: string;
  linkedEntityIds?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type AdminServiceResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

/**
 * Admin/support service. All mutations record actor, timestamp, reason,
 * and linked entity IDs in the admin_audit_log. No raw DB edits.
 */
export function createAdminService(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    /** Log an admin action (always audited). Actor is always auth.uid(). */
    async logAction(
      action: string,
      targetType: string,
      targetId: string | undefined,
      reason: string,
      linkedEntityIds?: Record<string, unknown>,
      metadata?: Record<string, unknown>,
    ): Promise<AdminServiceResult<{ id: number }>> {
      try {
        const { data, error } = await adminClient.rpc(
          "log_admin_action",
          {
            p_action: action,
            p_target_type: targetType,
            p_target_id: targetId ?? null,
            p_reason: reason,
            p_linked_entity_ids: linkedEntityIds ?? null,
            p_metadata: metadata ?? null,
          },
        );
        if (error) return { status: "unavailable" };
        return { status: "ok", data: { id: data as number } };
      } catch (error) {
        logServiceError({ service: "admin-service", operation: "logAction", error });
        return { status: "unavailable" };
      }
    },

    /** Search admin audit log by action type. */
    async searchAuditLog(
      action?: string,
      targetType?: string,
      limit: number = 50,
    ): Promise<AdminServiceResult<AdminAuditEntry[]>> {
      try {
        let query = adminClient
          .from("admin_audit_log")
          .select("id, actor_id, action, target_type, target_id, reason, linked_entity_ids, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (action) query = query.eq("action", action);
        if (targetType) query = query.eq("target_type", targetType);
        const { data, error } = await query;
        if (error) return { status: "unavailable" };
        return {
          status: "ok",
          data: (data || []).map((row) => ({
            id: row.id,
            actorId: row.actor_id,
            action: row.action,
            targetType: row.target_type,
            targetId: row.target_id ?? undefined,
            reason: row.reason,
            linkedEntityIds: row.linked_entity_ids ?? undefined,
            metadata: row.metadata ?? undefined,
            createdAt: row.created_at,
          })),
        };
      } catch (error) {
        logServiceError({ service: "admin-service", operation: "searchAuditLog", error });
        return { status: "unavailable" };
      }
    },

    /** Search users by email or ID (admin only). */
    async searchUsers(
      query: string,
      limit: number = 20,
    ): Promise<AdminServiceResult<Array<{ id: string; email?: string; role?: string }>>> {
      try {
        let q = adminClient
          .from("profiles")
          .select("id, email, role")
          .limit(limit);
        if (query.includes("@")) {
          q = q.ilike("email", `%${query}%`);
        } else {
          q = q.eq("id", query);
        }
        const { data, error } = await q;
        if (error) return { status: "unavailable" };
        return {
          status: "ok",
          data: (data || []).map((row) => ({
            id: row.id,
            email: row.email ?? undefined,
            role: row.role ?? undefined,
          })),
        };
      } catch (error) {
        logServiceError({ service: "admin-service", operation: "searchUsers", error });
        return { status: "unavailable" };
      }
    },

    /** Get dispute records. */
    async searchDisputes(
      status?: string,
      limit: number = 50,
    ): Promise<AdminServiceResult<Array<Record<string, unknown>>>> {
      try {
        let query = adminClient
          .from("disputes")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data || [] };
      } catch (error) {
        logServiceError({ service: "admin-service", operation: "searchDisputes", error });
        return { status: "unavailable" };
      }
    },

    /** Get host cancellation records. */
    async searchHostCancellations(
      hostId?: string,
      limit: number = 50,
    ): Promise<AdminServiceResult<Array<Record<string, unknown>>>> {
      try {
        let query = adminClient
          .from("host_cancellation_records")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (hostId) query = query.eq("host_id", hostId);
        const { data, error } = await query;
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data || [] };
      } catch (error) {
        logServiceError({ service: "admin-service", operation: "searchHostCancellations", error });
        return { status: "unavailable" };
      }
    },
  };
}
