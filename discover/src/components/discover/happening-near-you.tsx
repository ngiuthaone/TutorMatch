"use client";

import { useState } from "react";
import { IconMapPin, IconWorld, IconCalendar, IconClock, IconUsers } from "@tabler/icons-react";

const allEvents = [
  {
    title: "Beginner Pottery Workshop",
    date: "Sunday",
    time: "2:00 PM",
    location: "Tay Ho, Ha Noi",
    type: "In person",
    attendees: 12,
    image: "https://picsum.photos/seed/pottery-workshop/400/240",
  },
  {
    title: "IELTS Speaking Group",
    date: "Saturday",
    time: "10:00 AM",
    location: "Online",
    type: "Online",
    attendees: 8,
    image: "https://picsum.photos/seed/ielts-group/400/240",
  },
  {
    title: "Startup Networking Night",
    date: "Friday, 24 Jul",
    time: "6:30 PM",
    location: "Hoan Kiem, Ha Noi",
    type: "In person",
    attendees: 45,
    image: "https://picsum.photos/seed/startup-networking/400/240",
  },
  {
    title: "Watercolor Painting Session",
    date: "Next Tuesday",
    time: "3:00 PM",
    location: "Online",
    type: "Online",
    attendees: 20,
    image: "https://picsum.photos/seed/watercolor/400/240",
  },
];

const onlineEvents = allEvents.filter((e) => e.type === "Online");
const inPersonEvents = allEvents.filter((e) => e.type === "In person");

export function HappeningNearYou() {
  const [mode, setMode] = useState<"all" | "near" | "online">("all");

  const displayed = mode === "online" ? onlineEvents : mode === "near" ? inPersonEvents : allEvents;

  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Happening near you
          </h2>
          <a href="/events" className="text-sm text-primary hover:text-primary-dark font-medium transition-colors">
            See all events
          </a>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[
            { key: "all", label: "All" },
            { key: "near", label: "Near me", icon: IconMapPin },
            { key: "online", label: "Online", icon: IconWorld },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key as typeof mode)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                mode === tab.key
                  ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light"
                  : "border-border text-muted hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {tab.icon && <tab.icon size={13} />}
              {tab.label}
            </button>
          ))}
        </div>

        {displayed.length === 0 && (
          <div className="text-center py-12 text-sm text-muted border border-dashed border-border rounded-2xl">
            No {mode === "near" ? "in-person" : ""} events happening near you right now.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayed.map((event) => (
            <a
              key={event.title}
href="/events"
              className="group rounded-2xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden"
            >
              <div className="aspect-[4/3] overflow-hidden bg-surface">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <IconCalendar size={13} />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconClock size={13} />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconMapPin size={13} />
                    <span>{event.location}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <IconUsers size={13} />
                    <span>{event.attendees} attending</span>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    event.type === "Online"
                      ? "bg-primary/10 text-primary-dark dark:text-primary-light"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  }`}>
                    {event.type}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
