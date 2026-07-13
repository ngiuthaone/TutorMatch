"use client";

import { CloudRain, Play } from "lucide-react";

const calendarDays = [
  null,
  null,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
];

interface AppleGlassProps {
  backgroundImage?: string;
  onPlay?: () => void;
}

export default function AppleGlass({
  backgroundImage,
  onPlay,
}: AppleGlassProps) {
  return (
    <main
      className={[
        "relative min-h-screen overflow-hidden px-4 py-5 text-white sm:px-8",
        backgroundImage ? "bg-cover bg-center" : "bg-black",
      ].join(" ")}
      style={backgroundImage ? { backgroundImage: `url("${backgroundImage}")` } : undefined}
    >
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative mx-auto flex w-full max-w-[690px] flex-col gap-8">
        <section className="grid grid-cols-2 gap-8">
          <CalendarWidget />
          <WeatherWidget />
        </section>

        <section className="relative isolate h-[325px] overflow-hidden rounded-[42px] border border-white/30 shadow-2xl shadow-black/10">
          <div className="absolute inset-0 backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" />

          <div className="relative flex h-full items-end justify-between p-9">
            <div className="pb-1">
              <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.04em] sm:text-[42px]">
                Year in Review
              </h1>
              <p className="mt-5 text-xl font-bold text-white/90 sm:text-2xl">
                2025
              </p>
            </div>

            <button
              type="button"
              onClick={onPlay}
              aria-label="Play year in review"
              className="mb-1 flex size-[72px] shrink-0 items-center justify-center rounded-full bg-white/90 text-white shadow-lg backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-white active:scale-95 sm:size-[88px]"
            >
              <Play
                className="ml-1 size-8 fill-white sm:size-10"
                strokeWidth={0}
              />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[38px]",
        "border border-white/35",
        "bg-white/5 backdrop-blur-2xl",
        "shadow-xl shadow-black/10",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent",
        className,
      ].join(" ")}
    >
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function CalendarWidget() {
  const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <GlassCard className="min-h-[325px]">
      <div className="px-8 py-9">
        <header className="flex items-center gap-2 text-[18px] font-extrabold sm:text-[21px]">
          <span>THÁNG 7</span>
          <span className="h-6 w-px bg-white/20" />
          <span className="text-white/50">28/5</span>
        </header>

        <div className="mt-4 grid grid-cols-7 gap-y-3 text-center text-[16px] font-bold sm:text-[20px]">
          {weekDays.map((day, index) => (
            <span
              key={day}
              className={index > 4 ? "text-white/45" : "text-white/85"}
            >
              {day}
            </span>
          ))}

          {calendarDays.map((day, index) => {
            if (!day) {
              return <span key={`empty-${index}`} />;
            }

            const isSelected = day === 12;
            const isUnderlined = day === 15;
            const columnIndex = index % 7;
            const isWeekend = columnIndex > 4;

            return (
              <div
                key={day}
                className="relative flex h-7 items-center justify-center"
              >
                <span
                  className={[
                    "relative flex size-8 items-center justify-center rounded-full",
                    isSelected
                      ? "bg-white/80 text-cyan-700"
                      : isWeekend
                        ? "text-white/45"
                        : "text-white/80",
                  ].join(" ")}
                >
                  {day}

                  {isUnderlined && (
                    <span className="absolute -bottom-1 h-0.5 w-7 rounded-full bg-white/75" />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

function WeatherWidget() {
  return (
    <GlassCard className="min-h-[325px]">
      <div className="flex h-full flex-col px-9 py-7">
        <h2 className="text-[25px] font-extrabold leading-tight sm:text-[30px]">
          Hà Nội
        </h2>

        <div className="-mt-1 text-[64px] font-light leading-none tracking-[-0.06em] sm:text-[84px]">
          32°
        </div>

        <div className="mt-auto">
          <CloudRain
            className="mb-2 size-9 fill-white/75 text-white/75"
            strokeWidth={1.7}
          />

          <p className="text-[22px] font-bold leading-tight sm:text-[27px]">
            Mưa
          </p>

          <p className="mt-1 text-[19px] font-bold text-white/85 sm:text-[24px]">
            C:32° T:26°
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
