"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Room = {
  id: string;
  room_number: string;
};

type Booking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
};

type Selection = {
  room: Room;
  start: string;
} | null;

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

const allowedDomains = [
  "@tc.columbia.edu",
  "@columbia.edu",
];

const adminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [hour, minute] = cleanTime(time).split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(total: number) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function cellEnd(cellTime: string) {
  return minutesToTime(timeToMinutes(cellTime) + 30);
}

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function overlaps(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string
) {
  return (
    timeToMinutes(existingStart) < timeToMinutes(newEnd) &&
    timeToMinutes(existingEnd) > timeToMinutes(newStart)
  );
}

function isWeekend(selectedDate: string) {
  const selectedDateObj = new Date(selectedDate + "T00:00:00");
  const day = selectedDateObj.getDay();

  return day === 0 || day === 6;
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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [view, setView] = useState<"booking" | "myBookings" | "admin">("booking");
  const [selection, setSelection] = useState<Selection>(null);

  const isAdmin = user?.email ? adminEmails.includes(user.email) : false;

  async function loadData() {
    const { data: roomsData } = await supabase
      .from("practice_rooms")
      .select("*")
      .order("room_number");

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", date);

    setRooms(roomsData || []);
    setBookings(bookingsData || []);

    if (user?.email) {
      const { data: mine } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_email", user.email)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      setMyBookings(mine || []);
    }
  }

  async function checkUser(currentUser: User | null) {
    if (
      currentUser &&
      !allowedDomains.some((domain) =>
        currentUser.email?.endsWith(domain)
      )
    ) {
      await supabase.auth.signOut();
      alert("Only TC or Columbia Google accounts are allowed.");
      setUser(null);
      return;
    }

    setUser(currentUser);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      checkUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        checkUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [date, user]);

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
    setMyBookings([]);
    setSelection(null);
    setView("booking");
  }

  function roomName(roomId: string) {
    return rooms.find((room) => room.id === roomId)?.room_number || "Room";
  }

  function isCellBooked(roomId: string, cellTime: string) {
    const end = cellEnd(cellTime);

    return bookings.some(
      (booking) =>
        booking.room_id === roomId &&
        booking.booking_date === date &&
        overlaps(booking.start_time, booking.end_time, cellTime, end)
    );
  }

  function hasConflict(roomId: string, start: string, end: string) {
    return bookings.some(
      (booking) =>
        booking.room_id === roomId &&
        booking.booking_date === date &&
        overlaps(booking.start_time, booking.end_time, start, end)
    );
  }

  function isPreviewCell(roomId: string, cellTime: string) {
    if (!selection) return false;
    if (selection.room.id !== roomId) return false;

    const start = selection.start;
    const end = cellEnd(cellTime);
    const duration = minutesBetween(start, end);

    return (
      timeToMinutes(cellTime) >= timeToMinutes(start) &&
      duration >= 30 &&
      (isAdmin || duration <= 120)
    );
  }

  async function checkDailyLimit(durationMinutes: number) {
    if (!user?.email) return false;

    const { data: dailyBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .eq("booking_date", date);

    const usedMinutes =
      dailyBookings?.reduce((total, booking) => {
        return total + minutesBetween(booking.start_time, booking.end_time);
      }, 0) || 0;

    if (usedMinutes + durationMinutes > 120) {
      alert("You can only book up to 2 hours per day.");
      return false;
    }

    return true;
  }

  async function checkWeeklyLimit(durationMinutes: number) {
    if (!user?.email) return false;

    const { start, end } = getWeekRange(date);

    const { data: weeklyBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .gte("booking_date", start)
      .lte("booking_date", end);

    const usedMinutes =
      weeklyBookings?.reduce((total, booking) => {
        return total + minutesBetween(booking.start_time, booking.end_time);
      }, 0) || 0;

    if (usedMinutes + durationMinutes > 300) {
      alert("You can only book up to 5 hours per week.");
      return false;
    }

    return true;
  }

  async function handleCellClick(room: Room, time: string) {
    if (!user) {
      alert("Please log in with your TC or Columbia Google account before booking.");
      return;
    }

    if (isWeekend(date)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    if (isCellBooked(room.id, time)) return;

    if (!selection || selection.room.id !== room.id) {
      setSelection({
        room,
        start: time,
      });
      return;
    }

    if (timeToMinutes(time) < timeToMinutes(selection.start)) {
      setSelection({
        room,
        start: time,
      });
      return;
    }

    const start = selection.start;
    const end = cellEnd(time);
    const duration = minutesBetween(start, end);

    if (duration < 30) {
      alert("Minimum booking time is 30 minutes.");
      setSelection(null);
      return;
    }

    if (!isAdmin && duration > 120) {
      alert("One booking can only be up to 2 hours.");
      setSelection(null);
      return;
    }

    if (hasConflict(room.id, start, end)) {
      alert("This booking overlaps with an existing reservation.");
      await loadData();
      setSelection(null);
      return;
    }

    if (!isAdmin) {
      const dailyOk = await checkDailyLimit(duration);
      if (!dailyOk) {
        setSelection(null);
        return;
      }

      const weeklyOk = await checkWeeklyLimit(duration);
      if (!weeklyOk) {
        setSelection(null);
        return;
      }
    }

    const confirmed = window.confirm(
      `Confirm booking for ${room.room_number} from ${start} to ${end}?`
    );

    if (!confirmed) {
      setSelection(null);
      return;
    }

    const optimisticBooking: Booking = {
      id: crypto.randomUUID(),
      room_id: room.id,
      booking_date: date,
      start_time: start,
      end_time: end,
      user_email: user.email || "",
    };

    setBookings((prev) => [...prev, optimisticBooking]);

    const { error } = await supabase.from("bookings").insert({
      room_id: room.id,
      user_id: user.id,
      user_email: user.email,
      booking_date: date,
      start_time: start,
      end_time: end,
    });

    if (error) {
      setBookings((prev) =>
        prev.filter((booking) => booking.id !== optimisticBooking.id)
      );

      alert("This room is already booked during that time.");
      await loadData();
      setSelection(null);
      return;
    }

    await fetch("/api/send-booking-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "confirm",
        email: user.email,
        room: room.room_number,
        date,
        startTime: start,
        endTime: end,
      }),
    });

    setSelection(null);
    await loadData();

    alert("Booking confirmed!");
  }

  async function cancelBooking(bookingId: string) {
    const confirmed = window.confirm("Cancel this booking?");
    if (!confirmed) return;

    const cancelledBooking = myBookings.find((b) => b.id === bookingId);

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .eq("user_email", user?.email);

    if (error) {
      alert(error.message);
    } else {
      if (cancelledBooking) {
        await fetch("/api/send-booking-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "cancel",
            email: user?.email,
            room: roomName(cancelledBooking.room_id),
            date: cancelledBooking.booking_date,
            startTime: cleanTime(cancelledBooking.start_time),
            endTime: cleanTime(cancelledBooking.end_time),
          }),
        });
      }

      alert("Booking cancelled.");
      await loadData();
    }
  }

  async function adminCancelBooking(bookingId: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm("Admin cancel this booking?");
    if (!confirmed) return;

    const cancelledBooking = bookings.find((b) => b.id === bookingId);

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (error) {
      alert(error.message);
    } else {
      if (cancelledBooking) {
        await fetch("/api/send-booking-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "cancel",
            email: cancelledBooking.user_email,
            room: roomName(cancelledBooking.room_id),
            date: cancelledBooking.booking_date,
            startTime: cleanTime(cancelledBooking.start_time),
            endTime: cleanTime(cancelledBooking.end_time),
          }),
        });
      }

      alert("Booking cancelled by admin.");
      await loadData();
    }
  }

  async function modifyBooking(booking: Booking) {
    const newDate = prompt("New date, format YYYY-MM-DD:", booking.booking_date);
    if (!newDate) return;

    if (isWeekend(newDate)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    const newRoomNumber = prompt("New room, example 515A:", roomName(booking.room_id));
    if (!newRoomNumber) return;

    const newStart = prompt("New start time, example 09:00 or 09:30:", cleanTime(booking.start_time));
    if (!newStart) return;

    const newEnd = prompt("New end time, example 09:30 or 11:00:", cleanTime(booking.end_time));
    if (!newEnd) return;

    const duration = minutesBetween(newStart, newEnd);

    if (duration < 30) {
      alert("Minimum booking time is 30 minutes.");
      return;
    }

    if (!isAdmin && duration > 120) {
      alert("Booking must be 2 hours or less.");
      return;
    }

    const selectedRoomForModify = rooms.find(
      (room) => room.room_number.toLowerCase() === newRoomNumber.toLowerCase()
    );

    if (!selectedRoomForModify) {
      alert("Room not found.");
      return;
    }

    const { data: conflicts } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", newDate)
      .eq("room_id", selectedRoomForModify.id)
      .neq("id", booking.id);

    const hasModifyConflict =
      conflicts?.some((existing) =>
        overlaps(existing.start_time, existing.end_time, newStart, newEnd)
      ) || false;

    if (hasModifyConflict) {
      alert("That new time overlaps with another booking.");
      return;
    }

    const confirmed = window.confirm(
      `Change booking to ${newRoomNumber} on ${newDate} from ${newStart} to ${newEnd}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .update({
        room_id: selectedRoomForModify.id,
        booking_date: newDate,
        start_time: newStart,
        end_time: newEnd,
      })
      .eq("id", booking.id)
      .eq("user_email", user?.email);

    if (error) {
      alert("That time is already booked.");
    } else {
      alert("Booking updated.");
      await loadData();
    }
  }

  function handleDateChange(newDate: string) {
    if (isWeekend(newDate)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    setSelection(null);
    setDate(newDate);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">
            Practice Room Reservation
          </h1>

          <p className="text-gray-600 mt-2">
            Rooms 515A–515L · Monday–Friday · 9AM–9PM
          </p>

          {selection && (
            <p className="text-sm text-gray-700 mt-3">
              Selected start:{" "}
              <strong>
                {selection.room.room_number} {selection.start}
              </strong>
              . Click an end cell in the same row to finish the booking.
            </p>
          )}
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          {user ? (
            <>
              <span className="text-gray-700">
                Logged in as <strong>{user.email}</strong>
              </span>

              <button
                onClick={() => setView("booking")}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Book Room
              </button>

              <button
                onClick={() => setView("myBookings")}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                My Bookings
              </button>

              {isAdmin && (
                <button
                  onClick={() => setView("admin")}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Admin
                </button>
              )}

              <button
                onClick={logout}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Log out
              </button>

              {selection && (
                <button
                  onClick={() => setSelection(null)}
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

          {view === "booking" && (
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="border rounded-lg px-4 py-2 ml-auto"
            />
          )}
        </div>

        {view === "booking" && (
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
                    <td className="p-4 border-b font-semibold bg-gray-50">
                      {room.room_number}
                    </td>

                    {times.map((time) => {
                      const booked = isCellBooked(room.id, time);
                      const preview = isPreviewCell(room.id, time);

                      return (
                        <td key={time} className="border-b p-0">
                          <button
                            disabled={booked}
                            onClick={() => handleCellClick(room, time)}
                            className={
                              booked
                                ? "bg-gray-300 text-gray-600 w-full h-8 cursor-not-allowed border border-gray-300 rounded-none"
                                : preview
                                ? "bg-gray-200 hover:bg-gray-200 w-full h-8 border border-gray-300 rounded-none"
                                : "bg-white hover:bg-gray-100 w-full h-8 border border-gray-300 rounded-none"
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
        )}

        {view === "myBookings" && (
          <div className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-6">My Bookings</h2>

            {myBookings.length === 0 && (
              <p className="text-gray-600">You do not have any bookings yet.</p>
            )}

            <div className="space-y-4">
              {myBookings.map((booking) => (
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
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => modifyBooking(booking)}
                      className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                    >
                      Modify
                    </button>

                    <button
                      onClick={() => cancelBooking(booking.id)}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "admin" && isAdmin && (
          <div className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-6">Admin: All Bookings</h2>

            <div className="mb-6">
              <label className="font-medium mr-4 text-gray-700">
                View Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="border rounded-lg px-4 py-2"
              />
            </div>

            {bookings.length === 0 && (
              <p className="text-gray-600">No bookings for this date.</p>
            )}

            <div className="space-y-4">
              {bookings.map((booking) => (
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
                  </div>

                  <button
                    onClick={() => adminCancelBooking(booking.id)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
