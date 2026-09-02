"use client";

import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

export interface ScheduledSession {
  id: string;
  title: string;
  start: Date;
  end: Date;
  learnerName?: string;
  status: "requested" | "confirmed" | "completed" | "cancelled" | "no_show";
  href: string;
}

interface TutorScheduleCalendarProps {
  sessions: ScheduledSession[];
  onSessionClick?: (session: ScheduledSession) => void;
  defaultView?: View;
}

const STATUS_COLOR: Record<string, string> = {
  requested: "#fbbf24",
  confirmed: "#10b981",
  completed: "#6b7280",
  cancelled: "#ef4444",
  no_show: "#a3a3a3",
};

export function TutorScheduleCalendar({ sessions, onSessionClick, defaultView = "week" }: TutorScheduleCalendarProps) {
  const [view, setView] = useState<View>(defaultView);
  const [date, setDate] = useState<Date>(new Date());

  const events = useMemo(() => sessions.map((s) => ({ ...s, resource: s })), [sessions]);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        views={["week", "month"]}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        onSelectEvent={(e) => onSessionClick?.(e as ScheduledSession)}
        eventPropGetter={(e) => {
          const s = e as ScheduledSession;
          return {
            style: {
              backgroundColor: STATUS_COLOR[s.status] ?? "#3b82f6",
              border: "none",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 12,
            },
          };
        }}
      />
    </div>
  );
}
