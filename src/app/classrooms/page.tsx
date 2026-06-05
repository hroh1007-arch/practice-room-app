"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Classroom = {
  id: string;
  room_number: string;
  description?: string | null;
};

type Booking = {
  id: string;
  classroom_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  remark?: string | null;
};

type UserRole = {
  email: string;
  role: "admin" | "instructor";
};

type Selection = {
  room: Classroom;
  start: string;
} | null;

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

const times = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
];

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function cellEnd(time: string) {
  return minutesToTime(timeToMinutes(time) + 30);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}

function isWeekend(date: string) {
  const day = new Date(date + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

function isPastDate(date: string) {
  return date < localToday();
}

function isPastTime(date: string, time: string) {
  const today = localToday();

  if (date < today) return true;
  if (date > today) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return timeToMinutes(time) < current;
}

function bookingEnded(booking: Booking) {
  const today = localToday();

  if (booking.booking_date < today) return true;
  if (booking.booking_date > today) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return timeToMinutes(booking.end_time) <= current;
}

export default function ClassroomPage() {
  const [user, setUser] = useState<User | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [date, setDate] = useState(localToday());
  const [selection, setSelection] = useState<Selection>(null);
  const [hoverTime, setHoverTime] = useState<string | null>(null);

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isBackupAdmin = user?.email
    ? backupAdminEmails.includes(user.email.toLowerCase())
    : false;

  const isAdmin = currentRole === "admin" || isBackupAdmin;
  const isInstructor = currentRole === "instructor";
  const allowed = isAdmin || isInstructor;

  async function loadData() {
    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: roomData } = await supabase
      .from("classrooms")
      .select("*")
      .order("room_number");

    setClassrooms(roomData || []);

    const { data: bookingData } = await supabase
      .from("classroom_bookings")
      .select("*")
      .eq("booking_date", date);

    setBookings((bookingData || []).filter((b) => !bookingEnded(b)));
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadData();
  }, [date, user?.email]);

  function isBooked(roomId: string, time: string) {
    const end = cellEnd(time);

    return bookings.some(
      (b) =>
        b.classroom_id === roomId &&
        overlaps(b.start_time, b.end_time, time, end) &&
        !bookingEnded(b)
    );
  }

  function hasConflict(roomId: string, start: string, end: string) {
    return bookings.some(
      (b) =>
        b.classroom_id === roomId &&
        overlaps(b.start_time, b.end_time, start, end) &&
        !bookingEnded(b)
    );
  }

  function isPreview(roomId: string, time: string) {
    if (!selection || !hoverTime) return false;
    if (selection.room.id !== roomId) return false;

    const end = cellEnd(hoverTime);

    return (
      timeToMinutes(time) >= timeToMinutes(selection.start) &&
      timeToMinutes(time) < timeToMinutes(end)
    );
  }

  async function handleClick(room: Classroom, time: string) {
    if (!allowed) {
      alert("Only instructors and admins can book classrooms.");
      return;
    }

    if (isPastDate(date)) {
      alert("Cannot book past dates.");
      return;
    }

    if (isWeekend(date)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    if (isPastTime(date, time)) {
      alert("Cannot book past times.");
      return;
    }

    if (isBooked(room.id, time)) return;

    if (!selection || selection.room.id !== room.id) {
      setSelection({ room, start: time });
      setHoverTime(time);
      return;
    }

    if (timeToMinutes(time) < timeToMinutes(selection.start)) {
      setSelection({ room, start: time });
      setHoverTime(time);
      return;
    }

    const start = selection.start;
    const end = cellEnd(time);

    if (hasConflict(room.id, start, end)) {
      alert("This classroom is already booked.");
      setSelection(null);
      setHoverTime(null);
      return;
    }

    const remark = window.prompt("Optional note/remark for this classroom booking:", "") || "";

    const confirmed = window.confirm(
      `Book ${room.room_number} from ${start} to ${end}?`
    );

    if (!confirmed) return;

    const { error } = await supabase.from("classroom_bookings").insert({
      classroom_id: room.id,
      booking_date: date,
      start_time: start,
      end_time: end,
      user_email: user?.email,
      remark,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSelection(null);
    setHoverTime(null);
    await loadData();
    alert("Classroom booked.");
  }

  async function cancelBooking(id: string, ownerEmail: string) {
    if (!isAdmin && ownerEmail !== user?.email) {
      alert("You can only cancel your own classroom booking.");
      return;
    }

    const confirmed = window.confirm("Cancel this classroom booking?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_bookings")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Cancelled.");
  }

  async function updateClassroomDescription(room: Classroom) {
    if (!isAdmin) return;

    const description = window.prompt(
      `Description for ${room.room_number}:`,
      room.description || ""
    );

    if (description === null) return;

    const { error } = await supabase
      .from("classrooms")
      .update({ description })
      .eq("id", room.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Description updated.");
  }

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/classrooms",
      },
    });
  }

  function handleDateChange(newDate: string) {
    if (isPastDate(newDate)) {
      alert("You cannot book a past date.");
      return;
    }

    if (isWeekend(newDate)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    setSelection(null);
    setHoverTime(null);
    setDate(newDate);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Classroom Reservation</h1>
          <p className="text-gray-600 mb-6">Instructor/Admin access only</p>

          <button
            onClick={login}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Log in with TC/CU Google
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full mt-3"
          >
            Back to Practice Rooms
          </button>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            Classroom booking is only available to instructors and admins.
          </p>

          <button
            onClick={() => (window.location.href = "/")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full"
          >
            Back to Practice Rooms
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">
            Classroom Reservation
          </h1>

          <p className="text-gray-600 mt-2">
            Instructor/Admin access only · 435, 519, 522, 524, 526
          </p>

          {selection && (
            <p className="text-sm text-gray-700 mt-3">
              Selected start:{" "}
              <strong>
                {selection.room.room_number} {selection.start}
              </strong>
              . Move your cursor to preview, then click an end cell.
            </p>
          )}
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          <button
            onClick={() => (window.location.href = "/")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Practice Rooms
          </button>

          <span className="text-gray-700">
            Logged in as <strong>{user.email}</strong>
            {isAdmin ? " · admin" : " · instructor"}
          </span>

          {selection && (
            <button
              onClick={() => {
                setSelection(null);
                setHoverTime(null);
              }}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Clear Selection
            </button>
          )}

          <input
            type="date"
            value={date}
            min={localToday()}
            onChange={(e) => handleDateChange(e.target.value)}
            className="border rounded-lg px-4 py-2 ml-auto"
          />
        </div>

        <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-4 text-left border-b">Classroom</th>

                {times.map((time) => (
                  <th key={time} className="p-3 text-sm font-medium border-b">
                    {time}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {classrooms.map((room) => (
                <tr key={room.id}>
                  <td className="p-4 border-b font-semibold bg-gray-50 text-left">
                    <div>{room.room_number}</div>

                    {room.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {room.description}
                      </div>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => updateClassroomDescription(room)}
                        className="text-xs text-blue-600 underline mt-1"
                      >
                        Edit description
                      </button>
                    )}
                  </td>

                  {times.map((time) => {
                    const booked = isBooked(room.id, time);
                    const preview = isPreview(room.id, time);
                    const past = isPastTime(date, time);

                    return (
                      <td key={time} className="border-b p-0">
                        <button
                          disabled={booked || past || isPastDate(date)}
                          onMouseEnter={() => {
                            if (selection?.room.id === room.id) {
                              setHoverTime(time);
                            }
                          }}
                          onClick={() => handleClick(room, time)}
                          className={
                            booked
                              ? "bg-gray-300 text-gray-600 w-full h-8 cursor-not-allowed border border-gray-300"
                              : past || isPastDate(date)
                              ? "bg-gray-100 text-gray-400 w-full h-8 cursor-not-allowed border border-gray-200"
                              : preview
                              ? "bg-gray-200 w-full h-8 border border-gray-300"
                              : "bg-white hover:bg-gray-100 w-full h-8 border border-gray-300"
                          }
                        >
                          {booked ? "Booked" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border p-6 mt-8">
          <h2 className="text-3xl font-bold mb-6">Classroom Bookings</h2>

          {bookings.length === 0 && (
            <p className="text-gray-600">No active classroom bookings.</p>
          )}

          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="border rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-lg">
                    {
                      classrooms.find((room) => room.id === booking.classroom_id)
                        ?.room_number
                    }
                  </p>

                  <p className="text-gray-600">
                    {booking.booking_date} · {cleanTime(booking.start_time)}–
                    {cleanTime(booking.end_time)}
                  </p>

                  <p className="text-gray-500 text-sm">{booking.user_email}</p>

                  {booking.remark && (
                    <p className="text-gray-500 text-sm">
                      Remark: {booking.remark}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => cancelBooking(booking.id, booking.user_email)}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
