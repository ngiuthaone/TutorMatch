"use client";
import React, { useEffect, useState } from "react";
import { Copy, Plus, Trash2, Link as LinkIcon, Check, X } from "lucide-react";

export type CouponDiscountType = "percent" | "fixed";
export type CouponStatus = "active" | "scheduled" | "expired" | "inactive";

export interface Coupon {
  id: string;
  code: string;
  internalName?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  starts?: string;
  expires?: string;
  limit: number;
  perLearner?: number;
  used: number;
  status: CouponStatus;
}

export interface PromotionsData {
  coupons: Coupon[];
}

export interface PromotionsPageProps {
  initialData?: Partial<PromotionsData>;
  title?: string;
  slug?: string;
  onChange?: (data: PromotionsData) => void;
}

const DEFAULT: PromotionsData = {
  coupons: [
    { id: "cpn-launch50", code: "LAUNCH50", internalName: "Launch promo", discountType: "fixed", discountValue: 249000, starts: "", expires: "2026-12-31", limit: 1000, perLearner: 1, used: 47, status: "active" },
  ],
};

function formatDiscount(c: Coupon): string {
  if (c.discountType === "percent") return `${c.discountValue}% off`;
  return `₫${Number(c.discountValue).toLocaleString("vi-VN")} off`;
}

function formatSchedule(c: Coupon): string {
  if (!c.starts && !c.expires) return "No expiry";
  if (c.starts && c.expires) return `${c.starts} → ${c.expires}`;
  if (c.expires) {
    const d = new Date(c.expires);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `Expired ${c.expires}`;
    if (diff <= 7) return `Ends in ${diff}d • ${c.expires}`;
    return c.expires;
  }
  return c.starts || "—";
}

function statusPill(s: CouponStatus): string {
  if (s === "active") return "pill-ok";
  if (s === "scheduled") return "pill-warn";
  if (s === "expired") return "pill-bad";
  return "pill-neutral";
}

function generateId(): string {
  return `cpn_${Math.random().toString(36).slice(2, 10)}`;
}

export default function PromotionsPage({ initialData, title = "", slug = "", onChange }: PromotionsPageProps) {
  const [data, setData] = useState<PromotionsData>(() => ({
    ...DEFAULT,
    ...initialData,
    coupons: initialData?.coupons ?? DEFAULT.coupons,
  }));
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState<Partial<Coupon>>({});

  useEffect(() => {
    onChange?.(data);
  }, [data, onChange]);

  const referralLink = `https://tutoria.vn/course/${slug || "your-course"}?ref=instructor`;

  const openNew = () => {
    setDraft({ code: "", internalName: "", discountType: "percent", discountValue: 20, starts: "", expires: "", limit: 100, perLearner: 1, status: "active" });
    setEditing({} as Coupon);
  };

  const openCopy = (c: Coupon) => {
    setDraft({ ...c, id: generateId(), code: "", used: 0, status: "active" });
    setEditing({} as Coupon);
  };

  const handleSave = () => {
    const code = (draft.code || "").trim().toUpperCase();
    if (!code || code.length < 3 || code.length > 20) return;
    if (!/^[A-Z0-9.\-_]+$/.test(code)) return;
    if (data.coupons.some((x) => x.code.toUpperCase() === code)) return;
    const val = Number(draft.discountValue);
    if (!val || val <= 0) return;
    if (draft.discountType === "percent" && val > 100) return;
    const newCoupon: Coupon = {
      id: generateId(),
      code,
      internalName: (draft.internalName || "").trim(),
      discountType: (draft.discountType as CouponDiscountType) || "percent",
      discountValue: val,
      starts: draft.starts || "",
      expires: draft.expires || "",
      limit: Number(draft.limit) || 100,
      perLearner: draft.perLearner ? Number(draft.perLearner) : 1,
      used: 0,
      status: (draft.expires && new Date(draft.expires) < new Date() ? "expired" : draft.starts && new Date(draft.starts) > new Date() ? "scheduled" : "active") as CouponStatus,
    };
    setData((d) => ({ ...d, coupons: [...d.coupons, newCoupon] }));
    setEditing(null);
  };

  const toggleStatus = (id: string) => {
    setData((d) => ({
      ...d,
      coupons: d.coupons.map((c) => (c.id === id ? { ...c, status: c.status === "active" ? "inactive" as CouponStatus : "active" as CouponStatus } : c)),
    }));
  };

  const handleRemove = (id: string) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    setData((d) => ({ ...d, coupons: d.coupons.filter((c) => c.id !== id) }));
  };

  const copyLink = (code: string) => {
    const link = `${referralLink.split("?")[0]}?couponCode=${code}`;
    navigator.clipboard?.writeText(link);
  };

  return (
    <>
      <section className="section">
        <h2 className="section-title">Instructor referral link</h2>
        <p className="section-desc">Share this unique link to attribute sales to your marketing. Expired coupons become referral links (24h attribution).</p>
        <div className="row promotions-link-row">
          <input className="field" readOnly value={referralLink} />
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(referralLink)}>
            Copy
          </button>
        </div>
      </section>

      <section className="section">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>Coupons</h2>
            <p className="section-desc" style={{ margin: "4px 0 0" }}>Create once, toggle on/off. Max 3 per course per month — immutable after creation.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New coupon
          </button>
        </div>

        {data.coupons.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", border: "1px dashed #cfd1d4", borderRadius: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No coupons yet</div>
            <div className="help" style={{ marginBottom: 12 }}>Create a discount for this course.</div>
            <button type="button" className="btn btn-sm btn-primary" onClick={openNew}>
              Create coupon
            </button>
          </div>
        ) : (
          <div className="coupon-table" style={{ border: "1px solid #e8e9eb", borderRadius: 12, overflow: "hidden" }}>
            <div className="coupon-row coupon-head" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr 0.9fr 0.8fr auto", gap: 12, padding: "10px 14px", background: "#f7f9fa", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#6b7280" }}>
              <span>Code</span>
              <span>Discount</span>
              <span>Schedule</span>
              <span>Uses</span>
              <span>Status</span>
              <span />
            </div>
            {data.coupons.map((c) => (
              <div key={c.id} className="coupon-row" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr 0.9fr 0.8fr auto", gap: 12, padding: "12px 14px", borderTop: "1px solid #e8e9eb", alignItems: "center", fontSize: 13 }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>{c.code}</div>
                  {c.internalName && <div style={{ fontSize: 11, color: "#8f9096" }}>{c.internalName}</div>}
                  <button type="button" onClick={() => copyLink(c.code)} style={{ fontSize: 11, color: "#4f46e5", background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <LinkIcon size={12} /> Share link
                  </button>
                </div>
                <div>
                  <span style={{ display: "inline-flex", padding: "2px 6px", borderRadius: 999, background: c.discountType === "percent" ? "#f3f0ff" : "#fff7ed", border: "1px solid #e8e9eb", fontSize: 11, fontWeight: 700 }}>{c.discountType === "percent" ? "Percent" : "Fixed"}</span>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{formatDiscount(c)}</div>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{formatSchedule(c)}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{c.used}/{c.limit}</div>
                  <div style={{ height: 4, background: "#e8e9eb", borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
                    <div style={{ width: `${Math.min(100, (c.used / c.limit) * 100)}%`, height: "100%", background: c.used / c.limit > 0.8 ? "#fbbf24" : "#17181a" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8f9096", marginTop: 2 }}>Per learner: {c.perLearner ?? 1}</div>
                </div>
                <div>
                  <button type="button" onClick={() => toggleStatus(c.id)} className={`pill ${statusPill(c.status)}`} style={{ cursor: "pointer", fontSize: 11, padding: "4px 8px", borderRadius: 999, border: "1px solid #e8e9eb" }}>
                    {c.status === "active" ? "Active" : c.status === "scheduled" ? "Scheduled" : c.status === "expired" ? "Expired" : "Inactive"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className="icon-btn" onClick={() => openCopy(c)} title="Copy as new" style={{ width: 28, height: 28 }}>
                    <Copy size={14} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => handleRemove(c.id)} title="Delete" style={{ width: 28, height: 28, color: "#dc2626" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`@media(max-width: 760px){ .coupon-table .coupon-row{ grid-template-columns: 1fr !important; gap: 8px !important; } .coupon-table .coupon-row.coupon-head{ display:none !important; } .coupon-table .coupon-row > div{ padding: 4px 0; } }`}</style>
      {editing !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }} onClick={() => setEditing(null)}>
          <div className="panel" style={{ width: "min(520px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>New coupon</h3>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <label>
                <span className="label">Code *</span>
                <input className="field" value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="SUMMER25" maxLength={20} style={{ fontFamily: "monospace", textTransform: "uppercase" }} />
                <div className="help">6–20 chars, A-Z, 0-9, . - _ only. Must be unique per course.</div>
              </label>
              <label>
                <span className="label">Internal name (optional)</span>
                <input className="field" value={draft.internalName || ""} onChange={(e) => setDraft({ ...draft, internalName: e.target.value })} placeholder="Summer launch" />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span className="label">Discount type</span>
                  <select className="field" value={draft.discountType || "percent"} onChange={(e) => setDraft({ ...draft, discountType: e.target.value as CouponDiscountType })}>
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                <label>
                  <span className="label">Value *</span>
                  <input className="field" type="number" min={1} max={draft.discountType === "percent" ? 100 : undefined} value={draft.discountValue ?? ""} onChange={(e) => setDraft({ ...draft, discountValue: Number(e.target.value) })} placeholder={draft.discountType === "percent" ? "20" : "50000"} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span className="label">Starts</span>
                  <input className="field" type="date" value={draft.starts || ""} onChange={(e) => setDraft({ ...draft, starts: e.target.value })} />
                </label>
                <label>
                  <span className="label">Ends</span>
                  <input className="field" type="date" value={draft.expires || ""} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span className="label">Total uses</span>
                  <input className="field" type="number" min={1} max={10000} value={draft.limit ?? 100} onChange={(e) => setDraft({ ...draft, limit: Number(e.target.value) })} />
                </label>
                <label>
                  <span className="label">Per learner</span>
                  <input className="field" type="number" min={1} value={draft.perLearner ?? 1} onChange={(e) => setDraft({ ...draft, perLearner: Number(e.target.value) })} />
                </label>
              </div>
              <div className="help">Max 3 per course per month. Immutable after creation — only toggle on/off. Expired coupons become referral links (24h attribution).</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave}>
                  Create coupon
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
