"use client";

import { useState } from "react";
import type { CalendarDay } from "@/lib/dashboard/types";

type CalendarLabels = {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  tests: string;
  questions: string;
  score: string;
  minutes: string;
  selected: string;
  none: string;
  less: string;
  more: string;
};

const INTENSITY_CLASSES = [
  "bg-white/5 border-white/10",
  "bg-emerald-950 border-emerald-900",
  "bg-emerald-800 border-emerald-700",
  "bg-emerald-600 border-emerald-500",
  "bg-emerald-400 border-emerald-300",
] as const;

const WEEKDAYS: (keyof CalendarLabels)[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function dayLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

export default function StudyCalendar({
  days,
  initialDate,
  labels,
}: {
  days: CalendarDay[];
  initialDate: string;
  labels: CalendarLabels;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;
  const monthDate = selectedDate ? new Date(`${selectedDate}T00:00:00Z`) : null;
  const monthLabel = monthDate && !Number.isNaN(monthDate.getTime())
    ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate)
    : "";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{monthLabel}</h3>
        <span className="text-xs text-slate-500">{labels.selected}</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5" role="group" aria-label={labels.selected}>
        {WEEKDAYS.map((weekday) => <span key={weekday} className="py-1 text-center text-[10px] font-medium text-slate-500">{labels[weekday]}</span>)}
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            aria-label={`${dayLabel(day.date)}: ${day.minutes} ${labels.minutes}, ${day.tests} ${labels.tests}, ${day.questions} ${labels.questions}${day.bestScore === null ? "" : `, ${labels.score} ${Math.round(day.bestScore)}%`}`}
            aria-pressed={selectedDate === day.date}
            title={`${dayLabel(day.date)} · ${day.minutes} ${labels.minutes}`}
            onClick={() => setSelectedDate(day.date)}
            className={`aspect-square min-h-8 min-w-0 rounded-md border ${INTENSITY_CLASSES[day.intensity]} transition hover:ring-2 hover:ring-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selectedDate === day.date ? "ring-2 ring-white" : ""} ${day.isToday ? "outline outline-1 outline-cyan-300/70" : ""}`}
          >
            <span className="sr-only">{dayLabel(day.date)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-500"><span>{labels.less}</span>{INTENSITY_CLASSES.map((tone, index) => <span key={tone} className={`h-3 w-3 rounded-sm border ${tone}`} aria-hidden="true" data-level={index} />)}<span>{labels.more}</span></div>
      {selectedDay ? (
        <div className="mt-4 border-t border-white/10 pt-3" aria-live="polite">
          <p className="text-xs font-semibold text-slate-200">{dayLabel(selectedDay.date)}</p>
          {selectedDay.intensity === 0 ? <p className="mt-2 text-xs text-slate-400">{labels.none}</p> : <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
            <CalendarStat label={labels.minutes} value={selectedDay.minutes} />
            <CalendarStat label={labels.tests} value={selectedDay.tests} />
            <CalendarStat label={labels.questions} value={selectedDay.questions} />
            <CalendarStat label={labels.score} value={selectedDay.bestScore === null ? "—" : `${Math.round(selectedDay.bestScore)}%`} />
          </dl>}
        </div>
      ) : null}
    </div>
  );
}

function CalendarStat({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-white">{value}</dd></div>;
}