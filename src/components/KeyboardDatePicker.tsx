"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";

type KeyboardDatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayString() {
  const now = new Date();
  return dateToString(now);
}

function dateToString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function parseDate(value: string) {
  return new Date(`${value || todayString()}T00:00:00`);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return dateToString(date);
}

function addMonths(value: string, months: number) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + months);
  return dateToString(date);
}

function clampDate(value: string, min?: string) {
  if (min && value < min) return min;
  return value;
}

function monthDays(cursor: string) {
  const date = parseDate(cursor);
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatDisplayDate(value: string) {
  return parseDate(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonth(value: string) {
  return parseDate(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function KeyboardDatePicker({
  id,
  label,
  value,
  onChange,
  min,
  className = "",
}: KeyboardDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(clampDate(value || todayString(), min));

  function openCalendar() {
    setCursor(clampDate(value || todayString(), min));
    setOpen(true);
  }

  function commit(nextValue = cursor) {
    const confirmed = clampDate(nextValue, min);
    onChange(confirmed);
    setCursor(confirmed);
    setOpen(false);
  }

  function moveCursor(nextValue: string) {
    setCursor(clampDate(nextValue, min));
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openCalendar();
      return;
    }

    if (!open) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveCursor(addDays(cursor, -1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveCursor(addDays(cursor, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveCursor(addDays(cursor, -7));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveCursor(addDays(cursor, 7));
    } else if (event.key === "PageUp") {
      event.preventDefault();
      moveCursor(addMonths(cursor, -1));
    } else if (event.key === "PageDown") {
      event.preventDefault();
      moveCursor(addMonths(cursor, 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      moveCursor(addDays(cursor, -parseDate(cursor).getDay()));
    } else if (event.key === "End") {
      event.preventDefault();
      moveCursor(addDays(cursor, 6 - parseDate(cursor).getDay()));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const cursorMonth = parseDate(cursor).getMonth();

  return (
    <div className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <input
        id={id}
        aria-label={label}
        aria-expanded={open}
        type="text"
        value={value}
        readOnly
        onClick={openCalendar}
        onFocus={() => setCursor(clampDate(value || todayString(), min))}
        className="border rounded-lg px-4 py-2 w-full cursor-pointer bg-white"
      />

      {open && (
        <button
          type="button"
          aria-label={`Close ${label} calendar`}
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-label={`${label} calendar`}
          className="absolute left-0 top-full z-50 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-5 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveCursor(addMonths(cursor, -1))}
              className="border rounded-lg px-4 py-2 hover:bg-gray-100"
            >
              Prev
            </button>

            <div className="text-center">
              <div className="font-semibold">{formatMonth(cursor)}</div>
              <div className="text-xs text-gray-500">{formatDisplayDate(cursor)}</div>
            </div>

            <button
              type="button"
              onClick={() => moveCursor(addMonths(cursor, 1))}
              className="border rounded-lg px-4 py-2 hover:bg-gray-100"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {weekdayLabels.map((day) => (
              <div key={day} className="py-1 font-semibold">
                {day}
              </div>
            ))}
          </div>

          <div role="grid" aria-label={`${label} dates`} className="grid grid-cols-7 gap-2">
            {monthDays(cursor).map((date) => {
              const dateValue = dateToString(date);
              const disabled = Boolean(min && dateValue < min);
              const selected = dateValue === value;
              const focused = dateValue === cursor;
              const outsideMonth = date.getMonth() !== cursorMonth;
              const weekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <button
                  key={dateValue}
                  type="button"
                  role="gridcell"
                  aria-selected={focused}
                  disabled={disabled}
                  onMouseEnter={() => !disabled && setCursor(dateValue)}
                  onClick={() => !disabled && commit(dateValue)}
                  className={[
                    "h-11 rounded-lg border text-base",
                    selected ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100",
                    focused && !selected ? "outline outline-2 outline-blue-500 outline-offset-1" : "",
                    outsideMonth ? "text-gray-400" : "",
                    weekend && !selected ? "bg-gray-50 text-gray-500" : "",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border rounded-lg px-3 py-2 hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => commit()}
              className="bg-black text-white rounded-lg px-3 py-2 hover:bg-gray-800"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
