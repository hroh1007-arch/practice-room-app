"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import KeyboardDatePicker from "@/components/KeyboardDatePicker";

type Suspension = {
  email: string;
  name: string | null;
  uni: string | null;
  reason: string | null;
  start_date: string | null;
  end_date: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active: boolean;
};

type PracticeBooking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
};

type ClassroomBooking = {
  id: string;
  classroom_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
};

type Room = {
  id: string;
  room_number: string;
};

const blockedDayPrefix = "blocked-day-";

const adminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date || today()}T00:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

function inclusiveDays(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`).getTime();
  const endDate = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endDate - startDate) / 86400000) + 1;
}

function cleanTime(time?: string | null) {
  return (time || "").slice(0, 5);
}

export default function AdminSuspensionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);

  const [name, setName] = useState("");
  const [uni, setUni] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [blockStartDate, setBlockStartDate] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin =
    !!user?.email && adminEmails.includes(user.email.toLowerCase());

  function uniToEmail(value: string) {
    const clean = value.trim().toLowerCase();
    if (clean.includes("@")) return clean;
    return `${clean}@tc.columbia.edu`;
  }

  async function loadData() {
    const { data, error } = await supabase
      .from("user_suspensions")
      .select("*")
      .order("active", { ascending: false })
      .order("email", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuspensions((data || []) as Suspension[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    loadData();
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/admin-suspensions",
      },
    });
  }

  async function saveSuspension() {
    setMessage("");

    const missing = [];
    if (!name.trim()) missing.push("name");
    if (!uni.trim()) missing.push("UNI/email");
    if (!startDate) missing.push("start date");
    if (!endDate) missing.push("end date");
    if (!reason.trim()) missing.push("reason");

    if (missing.length > 0) {
      setMessage("Missing: " + missing.join(", "));
      return;
    }

    if (endDate < startDate) {
      setMessage("End date must be the same as or after start date.");
      return;
    }

    const cleanUni = uni.trim().toLowerCase();
    const email = uniToEmail(cleanUni);
    const startsAt = `${startDate}T00:00:00`;
    const endsAt = `${endDate}T23:59:59`;

    await supabase
      .from("user_suspensions")
      .delete()
      .eq("email", email);

    const { error } = await supabase.from("user_suspensions").insert({
      email,
      name: name.trim(),
      uni: cleanUni,
      reason: reason.trim(),
      start_date: startDate,
      end_date: endDate,
      starts_at: startsAt,
      ends_at: endsAt,
      active: true,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setName("");
    setUni("");
    setStartDate("");
    setEndDate("");
    setReason("");

    await loadData();
    setMessage(`Suspension saved for ${inclusiveDays(startDate, endDate)} day(s).`);
  }

  async function saveBlockedDays() {
    setMessage("");

    if (!blockStartDate || !blockEndDate || !blockReason.trim()) {
      setMessage("Missing: start date, end date, or reason.");
      return;
    }

    if (blockEndDate < blockStartDate) {
      setMessage("End date must be the same as or after start date.");
      return;
    }

    const email = `${blockedDayPrefix}${blockStartDate}-to-${blockEndDate}-${Date.now()}@system.local`;
    const startsAt = `${blockStartDate}T00:00:00`;
    const endsAt = `${blockEndDate}T23:59:59`;

    const { error } = await supabase.from("user_suspensions").insert({
      email,
      name: "Blocked Days",
      uni: "system",
      reason: blockReason.trim(),
      start_date: blockStartDate,
      end_date: blockEndDate,
      starts_at: startsAt,
      ends_at: endsAt,
      active: true,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const cancelledCount = await cancelBookingsForBlockedDays(blockStartDate, blockEndDate);

    setBlockStartDate("");
    setBlockEndDate("");
    setBlockReason("");
    await loadData();
    setMessage(
      `Blocked booking for ${inclusiveDays(blockStartDate, blockEndDate)} day(s). Cancelled ${cancelledCount} existing booking(s).`
    );
  }

  async function cancelBookingsForBlockedDays(start: string, end: string) {
    const [{ data: rooms }, { data: classrooms }, { data: practiceBookings }, { data: classroomBookings }] =
      await Promise.all([
        supabase.from("practice_rooms").select("id, room_number"),
        supabase.from("classrooms").select("id, room_number"),
        supabase
          .from("bookings")
          .select("id, room_id, booking_date, start_time, end_time, user_email")
          .gte("booking_date", start)
          .lte("booking_date", end),
        supabase
          .from("classroom_bookings")
          .select("id, classroom_id, booking_date, start_time, end_time, user_email")
          .gte("booking_date", start)
          .lte("booking_date", end),
      ]);

    const roomName = (id: string) =>
      ((rooms || []) as Room[]).find((room) => room.id === id)?.room_number || "Practice Room";
    const classroomName = (id: string) =>
      ((classrooms || []) as Room[]).find((room) => room.id === id)?.room_number || "Classroom";

    const practiceRows = (practiceBookings || []) as PracticeBooking[];
    const classroomRows = (classroomBookings || []) as ClassroomBooking[];

    await Promise.all([
      ...practiceRows.map((booking) =>
        fetch("/api/send-booking-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "cancel",
            email: booking.user_email,
            room: roomName(booking.room_id),
            date: booking.booking_date,
            startTime: cleanTime(booking.start_time),
            endTime: cleanTime(booking.end_time),
          }),
        })
      ),
      ...classroomRows.map((booking) =>
        fetch("/api/send-booking-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "cancel",
            email: booking.user_email,
            room: classroomName(booking.classroom_id),
            date: booking.booking_date,
            startTime: cleanTime(booking.start_time),
            endTime: cleanTime(booking.end_time),
          }),
        })
      ),
    ]);

    const deleteTasks = [];
    if (practiceRows.length > 0) {
      deleteTasks.push(
        supabase
          .from("bookings")
          .delete()
          .in(
            "id",
            practiceRows.map((booking) => booking.id)
          )
      );
    }

    if (classroomRows.length > 0) {
      deleteTasks.push(
        supabase
          .from("classroom_bookings")
          .delete()
          .in(
            "id",
            classroomRows.map((booking) => booking.id)
          )
      );
    }

    const results = await Promise.all(deleteTasks);
    const deleteError = results.find((result) => result.error)?.error;
    if (deleteError) {
      setMessage(deleteError.message);
      return 0;
    }

    return practiceRows.length + classroomRows.length;
  }

  function setRange(days: number) {
    const start = startDate || today();
    setStartDate(start);
    setEndDate(addDays(start, days - 1));
  }

  async function endSuspension(email: string) {
    if (!confirm(`End suspension for ${email}?`)) return;

    const { error } = await supabase
      .from("user_suspensions")
      .update({ active: false })
      .eq("email", email);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData();
    setMessage("Suspension ended.");
  }

  const blockedDays = suspensions.filter((s) => s.email.startsWith(blockedDayPrefix));
  const userSuspensions = suspensions.filter((s) => !s.email.startsWith(blockedDayPrefix));

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Suspensions</h1>
          <p className="text-gray-600 mb-6">Admin login required.</p>

          <button
            onClick={login}
            className="bg-black text-white px-5 py-3 rounded-lg w-full"
          >
            Continue with TC/CU Google
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
          <p>Only admins can manage suspensions.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <button
        onClick={() => (window.location.href = "/admin-bookings")}
        className="fixed right-8 top-8 z-50 border bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100"
      >
        Admin
      </button>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">Suspensions</h1>
        <p className="text-gray-600 mb-8">
          Suspend users or block booking days such as holidays.
        </p>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 flex-wrap">
          <button
            onClick={() => (window.location.href = "/admin-roles")}
            className="border px-4 py-2 rounded-lg"
          >
            Manage Roles
          </button>
        </div>

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Block Booking Days</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Start Date
              </label>
              <KeyboardDatePicker
                id="blocked-days-start-date"
                label="Blocked days start date"
                value={blockStartDate}
                min={today()}
                onChange={(value) => {
                  setBlockStartDate(value);
                  if (blockEndDate && blockEndDate < value) setBlockEndDate(value);
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                End Date
              </label>
              <KeyboardDatePicker
                id="blocked-days-end-date"
                label="Blocked days end date"
                value={blockEndDate}
                min={blockStartDate || today()}
                onChange={setBlockEndDate}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => {
              const start = blockStartDate || today();
              setBlockStartDate(start);
              setBlockEndDate(start);
            }} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              1 day
            </button>
            <button type="button" onClick={() => {
              const start = blockStartDate || today();
              setBlockStartDate(start);
              setBlockEndDate(addDays(start, 2));
            }} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              3 days
            </button>
            <button type="button" onClick={() => {
              const start = blockStartDate || today();
              setBlockStartDate(start);
              setBlockEndDate(addDays(start, 6));
            }} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              7 days
            </button>
            {blockStartDate && blockEndDate && blockEndDate >= blockStartDate && (
              <span className="px-3 py-2 text-sm text-gray-600">
                Blocking {inclusiveDays(blockStartDate, blockEndDate)} day(s)
              </span>
            )}
          </div>

          <textarea
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Holiday, building closure, maintenance..."
            className="border rounded-lg px-4 py-2 w-full mt-4"
          />

          <button
            onClick={saveBlockedDays}
            className="bg-black text-white px-5 py-3 rounded-lg mt-4"
          >
            Block Days
          </button>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Create Suspension</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="border rounded-lg px-4 py-2"
            />

            <input
              value={uni}
              onChange={(e) => setUni(e.target.value)}
              placeholder="UNI or email"
              className="border rounded-lg px-4 py-2"
            />

            <div>
              <label className="block text-sm font-semibold mb-1">
                Start Date
              </label>
              <KeyboardDatePicker
                id="suspension-start-date"
                label="Suspension start date"
                value={startDate}
                min={today()}
                onChange={(value) => {
                  setStartDate(value);
                  if (endDate && endDate < value) setEndDate(value);
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                End Date
              </label>
              <KeyboardDatePicker
                id="suspension-end-date"
                label="Suspension end date"
                value={endDate}
                min={startDate || today()}
                onChange={setEndDate}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRange(1)} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              1 day
            </button>
            <button type="button" onClick={() => setRange(3)} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              3 days
            </button>
            <button type="button" onClick={() => setRange(7)} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              7 days
            </button>
            <button type="button" onClick={() => setRange(14)} className="border px-3 py-2 rounded-lg hover:bg-gray-100">
              14 days
            </button>
            {startDate && endDate && endDate >= startDate && (
              <span className="px-3 py-2 text-sm text-gray-600">
                Blocking {inclusiveDays(startDate, endDate)} day(s)
              </span>
            )}
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Suspension reason"
            className="border rounded-lg px-4 py-2 w-full mt-4"
          />

          <button
            onClick={saveSuspension}
            className="bg-black text-white px-5 py-3 rounded-lg mt-4"
          >
            Save Suspension
          </button>

          {message && (
            <p className="mt-4 text-sm font-semibold text-red-600">
              {message}
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
          <h2 className="text-2xl font-bold p-4">Blocked Days</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border text-left">Start</th>
                <th className="p-3 border text-left">End</th>
                <th className="p-3 border text-left">Reason</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedDays.map((s) => (
                <tr key={s.email}>
                  <td className="p-3 border">{s.start_date}</td>
                  <td className="p-3 border">{s.end_date}</td>
                  <td className="p-3 border">{s.reason}</td>
                  <td className="p-3 border">{s.active ? "Active" : "Ended"}</td>
                  <td className="p-3 border">
                    {s.active && (
                      <button onClick={() => endSuspension(s.email)} className="bg-black text-white px-3 py-1 rounded">
                        End
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {blockedDays.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={5}>
                    No blocked days found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border overflow-x-auto mt-8">
          <h2 className="text-2xl font-bold p-4">User Suspensions</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border text-left">Name</th>
                <th className="p-3 border text-left">UNI</th>
                <th className="p-3 border text-left">Email</th>
                <th className="p-3 border text-left">Start</th>
                <th className="p-3 border text-left">End</th>
                <th className="p-3 border text-left">Reason</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {userSuspensions.map((s) => (
                <tr key={s.email}>
                  <td className="p-3 border">{s.name}</td>
                  <td className="p-3 border">{s.uni}</td>
                  <td className="p-3 border">{s.email}</td>
                  <td className="p-3 border">{s.start_date}</td>
                  <td className="p-3 border">{s.end_date}</td>
                  <td className="p-3 border">{s.reason}</td>
                  <td className="p-3 border">
                    {s.active ? "Active" : "Ended"}
                  </td>
                  <td className="p-3 border">
                    {s.active && (
                      <button
                        onClick={() => endSuspension(s.email)}
                        className="bg-black text-white px-3 py-1 rounded"
                      >
                        End
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {userSuspensions.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={8}>
                    No suspensions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
