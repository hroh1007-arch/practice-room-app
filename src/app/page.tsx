"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Room = {
  id: string;
  room_number: string;
  description?: string | null;
};

type Booking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  remark?: string | null;
  recurring_series_id?: string | null;
};

type UserRole = {
  email: string;
  role: "admin" | "instructor";
};

const times = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
];

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
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

function getWeekRange(selectedDate: string) {
  const dateObj = new Date(selectedDate + "T00:00:00");
  const day = dateObj.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(dateObj);
  monday.setDate(dateObj.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);

  const [date, setDate] = useState(localToday());
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<string | null>(null);

  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringRoom, setRecurringRoom] = useState("");
  const [recurringStartDate, setRecurringStartDate] = useState(localToday());
  const [recurringEndDate, setRecurringEndDate] = useState(localToday());
  const [recurringWeekday, setRecurringWeekday] = useState("1");
  const [recurringStartTime, setRecurringStartTime] = useState("09:00");
  const [recurringEndTime, setRecurringEndTime] = useState("10:00");
  const [recurringRemark, setRecurringRemark] = useState("");

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isBackupAdmin = user?.email
    ? backupAdminEmails.includes(user.email.toLowerCase())
    : false;

  const isAdmin = currentRole === "admin" || isBackupAdmin;
  const isInstructor = currentRole === "instructor";
  const hasUnlimitedBooking = isAdmin || isInstructor;

  async function loadData() {
    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: roomData } = await supabase
      .from("practice_rooms")
      .select("*")
      .order("room_number");

    setRooms(
      (roomData || []).filter(
        (room) =>
          room.room_number !== "515I" &&
          !["435", "519", "522", "524", "526"].includes(room.room_number)
      )
    );

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", date);

    setBookings((bookingData || []).filter((b) => !bookingEnded(b)));

    if (user?.email) {
      const { data: mine } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_email", user.email)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      setMyBookings((mine || []).filter((b) => !bookingEnded(b)));
    }

    if (isAdmin || isInstructor) {
      const { data: all } = await supabase
        .from("bookings")
        .select("*")
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      setAdminBookings((all || []).filter((b) => !bookingEnded(b)));
    }
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
  }, [date, user?.email, isAdmin, isInstructor]);

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    location.reload();
  }

  function roomName(roomId: string) {
    return rooms.find((room) => room.id === roomId)?.room_number || "Room";
  }

  function isBooked(roomId: string, time: string) {
    const end = cellEnd(time);

    return bookings.some(
      (b) =>
        b.room_id === roomId &&
        overlaps(b.start_time, b.end_time, time, end)
    );
  }

  function isPreview(roomId: string, time: string) {
    if (!selectedRoom || !selectedStart || !hoverTime) return false;
    if (selectedRoom.id !== roomId) return false;

    const previewEnd = cellEnd(hoverTime);

    return (
      timeToMinutes(time) >= timeToMinutes(selectedStart) &&
      timeToMinutes(time) < timeToMinutes(previewEnd)
    );
  }

  async function checkDailyLimit(duration: number) {
    if (!user?.email) return false;

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .eq("booking_date", date);

    const used =
      data?.reduce((total, b) => {
        if (bookingEnded(b)) return total;
        return total + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time));
      }, 0) || 0;

    if (used + duration > 120) {
      alert("Students can only book 2 hours per day.");
      return false;
    }

    return true;
  }

  async function checkWeeklyLimit(duration: number) {
    if (!user?.email) return false;

    const { start, end } = getWeekRange(date);

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .gte("booking_date", start)
      .lte("booking_date", end);

    const used =
      data?.reduce((total, b) => {
        if (bookingEnded(b)) return total;
        return total + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time));
      }, 0) || 0;

    if (used + duration > 300) {
      alert("Students can only book 5 hours per week.");
      return false;
    }

    return true;
  }

  async function handleCellClick(room: Room, time: string) {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (isPastDate(date) || isPastTime(date, time)) {
      alert("Cannot book past time.");
      return;
    }

    if (isWeekend(date)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    if (room.room_number === "515K" && !hasUnlimitedBooking) {
      alert("515K is only available to instructors/admins.");
      return;
    }

    if (isBooked(room.id, time)) return;

    if (!selectedRoom || selectedRoom.id !== room.id) {
      setSelectedRoom(room);
      setSelectedStart(time);
      setHoverTime(time);
      return;
    }

    if (timeToMinutes(time) < timeToMinutes(selectedStart || time)) {
      setSelectedRoom(room);
      setSelectedStart(time);
      setHoverTime(time);
      return;
    }

    const start = selectedStart!;
    const end = cellEnd(time);
    const duration = timeToMinutes(end) - timeToMinutes(start);

    if (!hasUnlimitedBooking && duration > 120) {
      alert("Students can only book up to 2 hours at once.");
      setSelectedRoom(null);
      setSelectedStart(null);
      setHoverTime(null);
      return;
    }

    const conflict = bookings.some(
      (b) =>
        b.room_id === room.id &&
        overlaps(b.start_time, b.end_time, start, end)
    );

    if (conflict) {
      alert("This room is already booked.");
      setSelectedRoom(null);
      setSelectedStart(null);
      setHoverTime(null);
      return;
    }

    if (!hasUnlimitedBooking) {
      const dailyOk = await checkDailyLimit(duration);
      if (!dailyOk) return;

      const weeklyOk = await checkWeeklyLimit(duration);
      if (!weeklyOk) return;
    }

    const remark = window.prompt("Optional remark/note:", "") || "";

    const confirmed = window.confirm(
      `Book ${room.room_number} from ${start} to ${end}?`
    );

    if (!confirmed) return;

    const { error } = await supabase.from("bookings").insert({
      room_id: room.id,
      booking_date: date,
      start_time: start,
      end_time: end,
      user_email: user.email,
      user_id: user.id,
      remark,
      checked_in: hasUnlimitedBooking,
      checked_in_at: hasUnlimitedBooking ? new Date().toISOString() : null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedRoom(null);
    setSelectedStart(null);
    setHoverTime(null);

    await loadData();

    alert("Booked.");
  }

  async function cancelBooking(id: string) {
    const confirmed = window.confirm("Cancel this booking?");
    if (!confirmed) return;

    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function cancelSeries(seriesId: string) {
    const confirmed = window.confirm("Cancel all bookings in this recurring series?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurring_series_id", seriesId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Recurring series cancelled.");
  }

  async function updateRoomDescription(room: Room) {
    if (!isAdmin) return;

    const description = window.prompt(
      `Description for ${room.room_number}:`,
      room.description || ""
    );

    if (description === null) return;

    const { error } = await supabase
      .from("practice_rooms")
      .update({ description })
      .eq("id", room.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function createRecurringBooking() {
    if (!hasUnlimitedBooking) {
      alert("Only instructors/admins can create recurring bookings.");
      return;
    }

    const response = await fetch("/api/recurring-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: recurringRoom,
        startDate: recurringStartDate,
        endDate: recurringEndDate,
        weekday: recurringWeekday,
        startTime: recurringStartTime,
        endTime: recurringEndTime,
        remark: recurringRemark,
        email: user?.email,
      }),
    });

    const data = await response.json();

    alert(data.message);

    setShowRecurringModal(false);
    await loadData();
  }

  return (
    <>
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-2xl font-bold">Recurring Booking</h2>

            <input
              placeholder="Room Number"
              value={recurringRoom}
              onChange={(e) => setRecurringRoom(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
            />

            <div>
              <label className="text-sm">Start Date</label>
              <input
                type="date"
                value={recurringStartDate}
                onChange={(e) => setRecurringStartDate(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm">End Date</label>
              <input
                type="date"
                value={recurringEndDate}
                onChange={(e) => setRecurringEndDate(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm">Repeat Day</label>
              <select
                value={recurringWeekday}
                onChange={(e) => setRecurringWeekday(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              >
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm">Start Time</label>
                <input
                  type="time"
                  value={recurringStartTime}
                  onChange={(e) => setRecurringStartTime(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                />
              </div>

              <div className="flex-1">
                <label className="text-sm">End Time</label>
                <input
                  type="time"
                  value={recurringEndTime}
                  onChange={(e) => setRecurringEndTime(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                />
              </div>
            </div>

            <textarea
              placeholder="Remark / Notes"
              value={recurringRemark}
              onChange={(e) => setRecurringRemark(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRecurringModal(false)}
                className="border px-4 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={createRecurringBooking}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-gray-900">
              Practice Room Reservation
            </h1>

            <p className="text-gray-600 mt-2">
              Rooms 515A–515L · Monday–Friday · 9AM–9PM
            </p>

            {selectedRoom && selectedStart && (
              <p className="text-sm text-gray-700 mt-3">
                Selected start:{" "}
                <strong>
                  {selectedRoom.room_number} {selectedStart}
                </strong>
                . Move cursor to preview, then click end cell.
              </p>
            )}
          </div>

          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
            {user ? (
              <>
                <span className="text-gray-700">
                  Logged in as <strong>{user.email}</strong>
                  {isAdmin && <span> · admin</span>}
                  {!isAdmin && isInstructor && <span> · instructor</span>}
                </span>

                <button
                  onClick={logout}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Log out
                </button>

                {hasUnlimitedBooking && (
                  <>
                    <button
                      onClick={() => setShowRecurringModal(true)}
                      className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                    >
                      Recurring Booking
                    </button>

                    <button
                      onClick={() => (window.location.href = "/classrooms")}
                      className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                    >
                      Classrooms
                    </button>
                  </>
                )}

                {selectedRoom && (
                  <button
                    onClick={() => {
                      setSelectedRoom(null);
                      setSelectedStart(null);
                      setHoverTime(null);
                    }}
                    className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                  >
                    Clear Selection
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800"
              >
                Continue with TC/CU Google
              </button>
            )}

            <input
              type="date"
              value={date}
              min={localToday()}
              onChange={(e) => {
                if (isWeekend(e.target.value)) {
                  alert("Weekend bookings are not allowed.");
                  return;
                }
                setDate(e.target.value);
              }}
              className="border rounded-lg px-4 py-2 ml-auto"
            />
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-left border-b">Room</th>

                  {times.map((time) => (
                    <th key={time} className="p-3 text-sm font-medium border-b">
                      {time}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rooms.map((room) => (
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
                          onClick={() => updateRoomDescription(room)}
                          className="text-xs text-blue-600 underline mt-1"
                        >
                          Edit description
                        </button>
                      )}

                      {room.room_number === "515K" && (
                        <div className="text-xs text-red-500 mt-1">
                          Instructor/Admin only
                        </div>
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
                              if (selectedRoom?.id === room.id) {
                                setHoverTime(time);
                              }
                            }}
                            onClick={() => handleCellClick(room, time)}
                            className={
                              booked
                                ? "bg-gray-300 text-gray-700 w-full h-8 cursor-not-allowed border border-gray-300 text-xs"
                                : past || isPastDate(date)
                                ? "bg-gray-100 text-gray-400 w-full h-8 cursor-not-allowed border border-gray-200 text-xs"
                                : preview
                                ? "bg-gray-200 w-full h-8 border border-gray-300 text-xs"
                                : "bg-white hover:bg-gray-100 w-full h-8 border border-gray-300 text-xs"
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
            <h2 className="text-3xl font-bold mb-6">Active Bookings</h2>

            {(hasUnlimitedBooking ? adminBookings : myBookings).length === 0 && (
              <p className="text-gray-600">No active bookings.</p>
            )}

            <div className="space-y-4">
              {(hasUnlimitedBooking ? adminBookings : myBookings).map((booking) => (
                <div
                  key={booking.id}
                  className="border rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-lg">
                      {roomName(booking.room_id)}
                    </p>

                    <p className="text-gray-600">
                      {booking.booking_date} · {cleanTime(booking.start_time)}–
                      {cleanTime(booking.end_time)}
                    </p>

                    <p className="text-gray-500 text-sm">
                      {booking.user_email}
                    </p>

                    {booking.remark && (
                      <p className="text-gray-500 text-sm">
                        Remark: {booking.remark}
                      </p>
                    )}

                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">
                        Recurring
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => cancelBooking(booking.id)}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Cancel
                    </button>

                    {booking.recurring_series_id && hasUnlimitedBooking && (
                      <button
                        onClick={() => cancelSeries(booking.recurring_series_id!)}
                        className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                      >
                        Cancel Series
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
