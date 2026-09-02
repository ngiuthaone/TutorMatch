"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { addDays, format, startOfDay } from "date-fns";

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface BookingDatePickerProps {
  tutorProfileId: string;
  onSlotSelected: (slot: TimeSlot) => void;
  selectedSlot?: TimeSlot | null;
}

interface FetchState {
  slots: TimeSlot[];
  loading: boolean;
  error: string | null;
}

export function BookingDatePicker({ tutorProfileId, onSlotSelected, selectedSlot }: BookingDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [state, setState] = useState<FetchState>({ slots: [], loading: false, error: null });

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(today, 60), [today]);

  useEffect(() => {
    if (!selectedDate) {
      setState({ slots: [], loading: false, error: null });
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetch(`/api/v1/tutors/${tutorProfileId}/available-slots?date=${dateStr}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ slots?: TimeSlot[]; error?: string }>;
      })
      .then((payload) => {
        setState({ slots: payload.slots ?? [], loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ slots: [], loading: false, error: err instanceof Error ? err.message : String(err) });
      });

    return () => controller.abort();
  }, [tutorProfileId, selectedDate]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-medium text-zinc-900">Pick a date</h3>
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={[{ before: today }, { after: maxDate }]}
          showOutsideDays
        />
      </div>
      <div>
        <h3 className="mb-3 font-medium text-zinc-900">
          Available times
          {selectedDate && (
            <span className="ml-1 font-normal text-zinc-500">on {format(selectedDate, "MMM d")}</span>
          )}
        </h3>
        {state.loading && <div className="text-sm text-zinc-500">Loading…</div>}
        {state.error && <div className="text-sm text-red-600">{state.error}</div>}
        {!state.loading && !state.error && selectedDate && state.slots.length === 0 && (
          <div className="text-sm text-zinc-500">No times available on this date.</div>
        )}
        {!state.loading && !state.error && !selectedDate && (
          <div className="text-sm text-zinc-500">Select a date to see available times.</div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {state.slots.map((slot) => {
            const isSelected =
              selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
            return (
              <button
                key={`${slot.date}-${slot.startTime}`}
                type="button"
                onClick={() => onSlotSelected(slot)}
                className={`rounded border px-3 py-2 text-sm ${
                  isSelected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 text-zinc-900 hover:border-zinc-400"
                }`}
              >
                {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
                <span className="block text-[10px] opacity-60">{slot.timezone}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
