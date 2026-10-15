"use client";
import React, { useState, useEffect, useMemo } from "react";
import { TEST_PRICING } from "../test-data";

export interface PricingData {
  priceMode: "free" | "paid";
  priceTier: string;
  currency: string;
  premiumInstructor: boolean;
  payoutReady: boolean;
  taxInfo: boolean
}

export interface PricingPageProps {
  initialData?: Partial<PricingData>;
  onChange?: (data: PricingData) => void
}

const CURRENCIES = ["VND", "USD", "EUR", "GBP", "AUD", "CAD", "INR", "JPY"];

const SYMBOLS: Record<string, string> = {
  VND: "₫",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  INR: "₹",
  JPY: "¥",
};

function formatPrice(value: string, currency: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  const n = Number(digits);
  if (!n) return "";
  return `${SYMBOLS[currency] ?? ""}${n.toLocaleString("en-US")}`;
}

export function PricingPage({ initialData, onChange }: PricingPageProps) {
  const [data, setData] = useState<PricingData>({
    priceMode: "paid",
    ...TEST_PRICING,
    ...initialData,
  });

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const update = (patch: Partial<PricingData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const preview = useMemo(() => formatPrice(data.priceTier, data.currency), [
    data.priceTier,
    data.currency,
  ]);

  return (
  <>
<section className="udemy-pricing-copy">
        <h2>Set a backup price for your course</h2>
        <p>Learners will see this backup price if a marketplace deal price cannot be shown.</p>
        <p>
          If you offer the course for free, its total video length must remain under two hours
          and it cannot contain practice tests. Repeatedly switching between free and paid can
          also limit promotional announcements.
        </p>
        <button type="button" className="udemy-text-link" data-price-help>
          When will this price be shown?
        </button>
      </section>

      <div className="udemy-pricing-controls">
        <label>
          <span className="label">Currency</span>
          <select
            className="field currency-select"
            data-price-currency
            value={data.currency}
            onChange={(e) => update({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Course price</span>
          <input
            className="field tier-select"
            type="number"
            min={0}
            step={1}
            inputMode="decimal"
            data-bind="priceTier"
            value={data.priceTier}
            placeholder="499000"
            onChange={(e) => update({ priceTier: e.target.value })}
          />
        </label>
      </div>

      <div className="udemy-price-preview">
        Learner-facing list price <strong>{preview || "—"}</strong>
      </div>

      <button type="button" className="btn btn-primary udemy-pricing-save" data-save-pricing>
        Save
      </button>

      <div className="udemy-pricing-note">
        Course prices shown in other currencies are determined by the corresponding local
        price tier and can differ on mobile marketplaces.
      </div>
    </>
  );
}

export default PricingPage;
