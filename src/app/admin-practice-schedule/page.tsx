"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import KeyboardDatePicker from "@/components/KeyboardDatePicker";

type Role = {
  email: string;
  role: "admin" | "instructor";
};

type PracticeRoom = {
  id: string;
  room_number: string;
  description?: string | null;
};

type PracticeBooking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  user_name?: string | null;
  remark?: string | null;
  recurring_series_id?: string | null;
};

type BookingEditor = {
  id?: string;
  recurringSeriesId?: string | null;
  roomId: string;
  date: string;
  start: string;
  end: string;
  email: string;
  name: string;
  remark: string;
  mode: "single" | "recurring";
  recurringEndDate: string;
  recurringWeekday: string;
};

const times = [
  "09:00", "09:30",
  "10:00", "10:30",
  "11:00", "11:30",
  "12:00", "12:30",
  "13:00", "13:30",
  "14:00", "14:30",
  "15:00", "15:30",
  "16:00", "16:30",
  "17:00", "17:30",
  "18:00", "18:30",
  "19:00", "19:30",
  "20:00", "20:30",
];

const weekdays = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
];

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

function displayNameFromUser(user: any) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "there"
  );
}

function displayPerson(name?: string | null, email?: string | null) {
  const uni = email ? email.split("@")[0] : "";
  if (name && uni) return `${name} ${uni}`;
  return name || uni || "Unknown";
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function cleanTime(time?: string | null) {
  return (time || "").slice(0, 5);
}

function formatTime12(time: string) {
  const [hour, minute] = cleanTime(time).split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}

function addDays(date: string, days: number) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

function getWeekDates(selectedDate: string) {
  const dateObj = new Date(selectedDate + "T00:00:00");
  const day = dateObj.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(selectedDate, diffToMonday);

  return Array.from({ length: 5 }, (_, index) => addDays(monday, index));
}

function formatScheduleDate(date: string) {
  const dateObj = new Date(date + "T00:00:00");
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function weekdayFromDate(date: string) {
  const day = new Date(date + "T00:00:00").getDay();
  return day >= 1 && day <= 5 ? String(day) : "1";
}

function cellEnd(time: string) {
  const endMinutes = timeToMinutes(time) + 30;
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
}

function scheduleBlockColor(index: number) {
  const colors = [
    "bg-blue-600 border-blue-800",
    "bg-red-600 border-red-800",
    "bg-green-600 border-green-800",
    "bg-amber-700 border-amber-900",
    "bg-violet-600 border-violet-800",
    "bg-cyan-700 border-cyan-900",
    "bg-rose-600 border-rose-800",
  ];

  return colors[index % colors.length];
}

export default function AdminPracticeSchedulePage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rooms, setRooms] = useState<PracticeRoom[]>([]);
  const [bookings, setBookings] = useState<PracticeBooking[]>([]);
  const [authUserNames, setAuthUserNames] = useState<Record<string, string>>({});
  const [scheduleDate, setScheduleDate] = useState(localToday());
  const [scheduleMode, setScheduleMode] = useState<"day" | "week">("week");
  const [editor, setEditor] = useState<BookingEditor | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<BookingEditor | null>(null);

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isAdmin =
    currentRole === "admin" ||
    (user?.email ? backupAdminEmails.includes(user.email.toLowerCase()) : false);

  async function loadData(currentUser?: User | null) {
    const activeUser = currentUser || user;

    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: roomData } = await supabase
      .from("practice_rooms")
      .select("id, room_number, description")
      .order("room_number");

    const practiceRooms = (roomData || []).filter(
      (room) =>
        room.room_number !== "515I" &&
        !["435", "519", "522", "524", "526"].includes(room.room_number)
    );
    setRooms(practiceRooms);

    if (!activeUser?.email) return;

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("*")
      .gte("booking_date", localToday())
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    setBookings(bookingData || []);
    await loadAuthUserNames(bookingData || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      loadData(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      loadData(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/admin-practice-schedule",
      },
    });
  }

  async function loadAuthUserNames(rows: PracticeBooking[]) {
    const emails = Array.from(
      new Set(
        rows
          .map((booking) => booking.user_email)
          .filter(Boolean)
          .map((email) => email.toLowerCase())
      )
    );

    if (emails.length === 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) return;

    const response = await fetch("/api/user-display-names", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emails }),
    });

    if (!response.ok) return;

    const data = await response.json();
    setAuthUserNames(data.names || {});
  }

  function roomName(id: string) {
    return rooms.find((r) => r.id === id)?.room_number || id;
  }

  function bookingPerson(booking: PracticeBooking) {
    return displayPerson(
      booking.user_name || authUserNames[booking.user_email.toLowerCase()],
      booking.user_email
    );
  }

  function bookingForCell(roomId: string, date: string, time: string) {
    return bookings.find(
      (booking) =>
        booking.room_id === roomId &&
        booking.booking_date === date &&
        overlaps(booking.start_time, booking.end_time, time, cellEnd(time))
    );
  }

  function bookingsForDate(date: string) {
    return bookings.filter((booking) => booking.booking_date === date);
  }

  function openNewBooking(date = scheduleDate, roomId = rooms[0]?.id || "", start = "09:00") {
    setEditor({
      roomId,
      date,
      start,
      end: cellEnd(start),
      email: "",
      name: "",
      remark: "",
      mode: "single",
      recurringEndDate: date,
      recurringWeekday: weekdayFromDate(date),
    });
  }

  function openEditBooking(booking: PracticeBooking) {
    setEditor({
      id: booking.id,
      recurringSeriesId: booking.recurring_series_id,
      roomId: booking.room_id,
      date: booking.booking_date,
      start: cleanTime(booking.start_time),
      end: cleanTime(booking.end_time),
      email: booking.user_email,
      name: booking.user_name || authUserNames[booking.user_email.toLowerCase()] || "",
      remark: booking.remark || "",
      mode: "single",
      recurringEndDate: booking.booking_date,
      recurringWeekday: weekdayFromDate(booking.booking_date),
    });
  }

  function editorHasConflict(draft: BookingEditor) {
    return bookings.some(
      (booking) =>
        booking.id !== draft.id &&
        booking.room_id === draft.roomId &&
        booking.booking_date === draft.date &&
        overlaps(booking.start_time, booking.end_time, draft.start, draft.end)
    );
  }

  async function saveEditor() {
    if (!editor) return;

    if (!editor.roomId || !editor.date || !editor.start || !editor.end || !editor.email.trim()) {
      alert("Room, date, time, and email are required.");
      return;
    }

    if (timeToMinutes(editor.end) <= timeToMinutes(editor.start)) {
      alert("End time must be after start time.");
      return;
    }

    if (editor.id || editor.mode === "single") {
      if (editorHasConflict(editor)) {
        alert("This room already has a booking during that time.");
        return;
      }
    } else if (editor.recurringEndDate < editor.date) {
      alert("Recurring end date must be on or after the start date.");
      return;
    }

    if (!editor.id && editor.mode === "recurring") {
      const response = await fetch("/api/recurring-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName(editor.roomId),
          startDate: editor.date,
          endDate: editor.recurringEndDate,
          weekday: editor.recurringWeekday,
          startTime: editor.start,
          endTime: editor.end,
          remark: editor.remark.trim(),
          email: editor.email.trim().toLowerCase(),
          userName: editor.name.trim() || null,
          hasUnlimitedBooking: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.message || "Recurring bookings could not be created.");
        return;
      }

      if (data.message) alert(data.message);
      setEditor(null);
      await loadData(user);
      return;
    }

    if (editorHasConflict(editor)) {
      alert("This room already has a booking during that time.");
      return;
    }

    const payload = {
      room_id: editor.roomId,
      booking_date: editor.date,
      start_time: editor.start,
      end_time: editor.end,
      user_email: editor.email.trim().toLowerCase(),
      user_name: editor.name.trim() || null,
      remark: editor.remark.trim(),
      checked_in: true,
      checked_in_at: new Date().toISOString(),
    };

    const { error } = editor.id
      ? await supabase.from("bookings").update(payload).eq("id", editor.id)
      : await supabase.from("bookings").insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    setEditor(null);
    await loadData(user);
  }

  async function deleteEditorBooking() {
    if (!editor?.id) return;

    if (editor.recurringSeriesId) {
      setDeleteDraft(editor);
      return;
    }

    await confirmDeleteSingle(editor);
  }

  async function confirmDeleteSingle(draft: BookingEditor) {
    if (!draft.id) return;

    const { error } = await supabase.from("bookings").delete().eq("id", draft.id);

    if (error) {
      alert(error.message);
      return;
    }

    setDeleteDraft(null);
    setEditor(null);
    await loadData(user);
  }

  async function confirmDeleteSeries(draft: BookingEditor) {
    if (!draft.recurringSeriesId) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurring_series_id", draft.recurringSeriesId);

    if (error) {
      alert(error.message);
      return;
    }

    setDeleteDraft(null);
    setEditor(null);
    await loadData(user);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Practice Room Schedule</h1>
          <p className="text-gray-600 mb-6">Admin login required.</p>

          <button onClick={login} className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full">
            Continue with TC/CU Google
          </button>

          <button onClick={() => (window.location.href = "/")} className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full mt-3">
            Back to Main Menu
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Only admins can view this page.</p>

          <button onClick={() => (window.location.href = "/")} className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full">
            Back to Main Menu
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      {editor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-2xl overflow-hidden">
            <div className="bg-gray-900 text-white px-6 py-5">
              <h2 className="text-2xl font-bold">{editor.id ? "Edit Practice Booking" : "Add Practice Booking"}</h2>
              <p className="text-sm text-gray-300 mt-1">Admin schedule editor</p>
            </div>

            <div className="p-6 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Room</label>
                <select
                  value={editor.roomId}
                  onChange={(e) => setEditor({ ...editor, roomId: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.room_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Date</label>
                <KeyboardDatePicker
                  id="practice-editor-date"
                  label="Practice booking date"
                  value={editor.date}
                  min={localToday()}
                  onChange={(value) => setEditor({ ...editor, date: value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Start</label>
                <select
                  value={editor.start}
                  onChange={(e) => setEditor({ ...editor, start: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                >
                  {times.map((time) => (
                    <option key={time} value={time}>{formatTime12(time)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">End</label>
                <select
                  value={editor.end}
                  onChange={(e) => setEditor({ ...editor, end: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                >
                  {times.concat("21:00").map((time) => (
                    <option key={time} value={time}>{formatTime12(time)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Book for email</label>
                <input
                  value={editor.email}
                  onChange={(e) => setEditor({ ...editor, email: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="student@tc.columbia.edu"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Book for name</label>
                <input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="Student name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Note</label>
                <textarea
                  value={editor.remark}
                  onChange={(e) => setEditor({ ...editor, remark: e.target.value })}
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="Optional note"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex flex-wrap justify-between gap-3">
              <div>
                {editor.id && (
                  <button onClick={deleteEditorBooking} className="border border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50">
                    Delete Booking
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditor(null)} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
                  Cancel
                </button>
                <button onClick={saveEditor} className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">
                  Save Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">Practice Room Schedule</h1>
          <p className="text-gray-600 mt-2">
            Day and week view for practice room bookings.
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          <button onClick={() => (window.location.href = "/admin-bookings")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
            Admin Bookings
          </button>
          <button onClick={() => (window.location.href = "/practice")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
            Practice Rooms
          </button>
          <button onClick={() => (window.location.href = "/admin-classroom-schedule")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
            Classroom Schedule
          </button>
          <button onClick={() => (window.location.href = "/equipment")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">
            Equipment
          </button>

          <span className="text-gray-700 ml-auto">
            Hello <strong>{displayNameFromUser(user)}</strong> · Logged in as <strong>{user.email}</strong>
          </span>
        </div>

        <section className="bg-white rounded-2xl shadow-lg border p-6">
          <div className="flex items-center gap-4 flex-wrap mb-5">
            <div className="border rounded-lg overflow-hidden flex">
              <button
                onClick={() => setScheduleMode("day")}
                className={scheduleMode === "day" ? "bg-gray-900 text-white px-4 py-2" : "bg-white px-4 py-2 hover:bg-gray-100"}
              >
                Day
              </button>
              <button
                onClick={() => setScheduleMode("week")}
                className={scheduleMode === "week" ? "bg-gray-900 text-white px-4 py-2" : "bg-white px-4 py-2 hover:bg-gray-100"}
              >
                Week
              </button>
            </div>

            <KeyboardDatePicker
              id="practice-schedule-date"
              label="Practice room schedule date"
              value={scheduleDate}
              min={localToday()}
              onChange={setScheduleDate}
              className="w-40"
            />
            <button onClick={() => openNewBooking()} className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">
              Add Booking
            </button>
          </div>

          {scheduleMode === "day" ? (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full border-collapse text-center text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left border-b min-w-28">{formatScheduleDate(scheduleDate)}</th>
                    {times.map((time) => (
                      <th key={time} className="p-2 border-b font-medium min-w-20">
                        {formatTime12(time)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="p-3 border-b bg-gray-50 text-left">
                        <div className="font-semibold">{room.room_number}</div>
                        {room.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{room.description}</div>
                        )}
                      </td>

                      {(() => {
                        const cells: ReactNode[] = [];

                        for (let index = 0; index < times.length; index++) {
                          const time = times[index];
                          const booking = bookingForCell(room.id, scheduleDate, time);

                          if (booking) {
                            if (cleanTime(booking.start_time) !== time) continue;

                            const colSpan = Math.max(
                              1,
                              Math.min(
                                Math.ceil(minutesBetween(booking.start_time, booking.end_time) / 30),
                                times.length - index
                              )
                            );
                            const label = [
                              `${formatTime12(booking.start_time)}-${formatTime12(booking.end_time)}`,
                              bookingPerson(booking),
                              booking.remark,
                              booking.recurring_series_id ? "Recurring" : "",
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            cells.push(
                              <td key={booking.id} colSpan={colSpan} className="border-b p-0">
                                <button
                                  onClick={() => openEditBooking(booking)}
                                  title={label}
                                  className="bg-gray-300 text-gray-700 border border-gray-400 text-xs min-h-12 px-2 py-1 flex items-center justify-center overflow-hidden w-full hover:bg-gray-400/60"
                                >
                                  <span className="line-clamp-2">{label}</span>
                                </button>
                              </td>
                            );
                            continue;
                          }

                          cells.push(
                            <td key={time} className="border-b p-0">
                              <button
                                onClick={() => openNewBooking(scheduleDate, room.id, time)}
                                aria-label={`Add booking ${room.room_number} ${formatTime12(time)}`}
                                className="bg-white border border-gray-200 h-12 w-full hover:bg-gray-50 focus:bg-gray-100"
                              />
                            </td>
                          );
                        }

                        return cells;
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <div
                className="relative min-w-[980px] grid text-sm"
                style={{
                  gridTemplateColumns: "72px repeat(5, minmax(170px, 1fr))",
                  gridTemplateRows: `44px repeat(${times.length}, 32px)`,
                }}
              >
                <div className="sticky left-0 z-20 bg-gray-50 border-b border-r" />

                {getWeekDates(scheduleDate).map((date, dayIndex) => (
                  <div
                    key={date}
                    className={
                      date === localToday()
                        ? "bg-yellow-50 border-b border-r p-2 text-center font-semibold"
                        : "bg-gray-50 border-b border-r p-2 text-center font-semibold"
                    }
                    style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
                  >
                    {formatScheduleDate(date)}
                  </div>
                ))}

                {times.map((time, timeIndex) => (
                  <div
                    key={time}
                    className="sticky left-0 z-10 bg-gray-50 border-b border-r px-2 py-1 text-right text-xs text-gray-600"
                    style={{ gridColumn: 1, gridRow: timeIndex + 2 }}
                  >
                    {time.endsWith(":00") ? formatTime12(time) : ""}
                  </div>
                ))}

                {getWeekDates(scheduleDate).map((date, dayIndex) =>
                  times.map((time, timeIndex) => (
                    <div
                      key={`${date}-${time}`}
                      className={
                        date === localToday()
                          ? "bg-yellow-50/70 border-b border-r border-gray-200"
                          : "bg-white border-b border-r border-gray-200"
                      }
                      style={{ gridColumn: dayIndex + 2, gridRow: timeIndex + 2 }}
                    />
                  ))
                )}

                {getWeekDates(scheduleDate).flatMap((date, dayIndex) =>
                  bookingsForDate(date).map((booking) => {
                    const startIndex = times.findIndex((time) => time === cleanTime(booking.start_time));
                    if (startIndex < 0) return null;

                    const roomIndex = Math.max(
                      0,
                      rooms.findIndex((room) => room.id === booking.room_id)
                    );
                    const rowSpan = Math.max(
                      1,
                      Math.ceil(minutesBetween(booking.start_time, booking.end_time) / 30)
                    );
                    const label = [
                      roomName(booking.room_id),
                      `${formatTime12(booking.start_time)}-${formatTime12(booking.end_time)}`,
                      bookingPerson(booking),
                      booking.remark,
                      booking.recurring_series_id ? "Recurring" : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <button
                        key={`${date}-${booking.id}`}
                        onClick={() => openEditBooking(booking)}
                        title={label}
                        className={`${scheduleBlockColor(roomIndex)} z-20 m-1 rounded px-2 py-1 text-xs text-white shadow-sm overflow-hidden text-left hover:brightness-110`}
                        style={{
                          gridColumn: dayIndex + 2,
                          gridRow: `${startIndex + 2} / span ${rowSpan}`,
                        }}
                      >
                        <div className="font-semibold">
                          {roomName(booking.room_id)} · {formatTime12(booking.start_time)}-{formatTime12(booking.end_time)}
                        </div>
                        <div>{bookingPerson(booking)}</div>
                        {booking.remark && <div>{booking.remark}</div>}
                        {booking.recurring_series_id && <div>Recurring</div>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
