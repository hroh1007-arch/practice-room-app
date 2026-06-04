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

const endTimes = [
  "09:30",
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
  "21:00",
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

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function overlaps(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string
) {
  return timeToMinutes(existingStart) < timeToMinutes(newEnd) &&
    timeToMinutes(existingEnd) > timeToMinutes(newStart);
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
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [view, setView] = useState<"booking" | "myBookings" | "admin">("booking");

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
      !allowedDomains.some((domain) => currentUser.email?.endsWith(domain))
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
    setView("booking");
  }

  function roomName(roomId: string) {
    return rooms.find((room) => room.id === roomId)?.room_number || "Room";
  }

  function isCellBooked(roomId: string, cellTime: string) {
    const cellEnd = endTimes[times.indexOf(cellTime)];

    return bookings.some(
      (booking) =>
        booking.room_id === roomId &&
        booking.booking_date === date &&
        overlaps(booking.start_time, booking.end_time, cellTime, cellEnd)
    );
  }

  function selectedDurationMinutes() {
    return minutesBetween(startTime, endTime);
  }

  function validateSelectedTime() {
    const duration = selectedDurationMinutes();

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      alert("End time must be after start time.");
      return false;
    }

    if (duration < 30) {
      alert("Minimum booking time is 30 minutes.");
      return false;
    }

    if (duration > 120) {
      alert("Maximum booking time is 2 hours.");
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

  async function bookRoom(roomId: string) {
    if (!user) {
      alert("Please log in with your TC or Columbia Google account before booking.");
      return;
    }

    if (!validateSelectedTime()) return;

    const duration = selectedDurationMinutes();

    const localConflict = bookings.find(
      (booking) =>
        booking.room_id === roomId &&
        booking.booking_date === date &&
        overlaps(booking.start_time, booking.end_time, startTime, endTime)
    );

    if (localConflict) {
      alert("This room is already booked during that time.");
      await loadData();
      return;
    }

    const weeklyOk = await checkWeeklyLimit(duration);
    if (!weeklyOk) return;

    const optimisticBooking: Booking = {
      id: crypto.randomUUID(),
      room_id: roomId,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      user_email: user.email || "",
    };

    setBookings((prev) => [...prev, optimisticBooking]);

    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      user_id: user.id,
      user_email: user.email,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      setBookings((prev) =>
        prev.filter((booking) => booking.id !== optimisticBooking.id)
      );

      alert("This room is already booked during that time.");
      await loadData();
      return;
    }

    await loadData();
    alert("Booking confirmed!");
  }

  async function cancelBooking(bookingId: string) {
    const confirmed = window.confirm("Cancel this booking?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .eq("user_email", user?.email);

    if (error) {
      alert(error.message);
    } else {
      alert("Booking cancelled.");
      await loadData();
    }
  }

  async function adminCancelBooking(bookingId: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm("Admin cancel this booking?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (error) {
      alert(error.message);
    } else {
      alert("Booking cancelled by admin.");
      await loadData();
    }
  }

  async function modifyBooking(booking: Booking) {
    const newDate = prompt("New date, format YYYY-MM-DD:", booking.booking_date);
    if (!newDate) return;

    const newRoomNumber = prompt("New room, example 515A:", roomName(booking.room_id));
    if (!newRoomNumber) return;

    const newStart = prompt("New start time, example 09:00 or 09:30:", cleanTime(booking.start_time));
    if (!newStart) return;

    const newEnd = prompt("New end time, example 09:30 or 11:00:", cleanTime(booking.end_time));
    if (!newEnd) return;

    const duration = minutesBetween(newStart, newEnd);

    if (duration < 30 || duration > 120) {
      alert("Booking must be between 30 minutes and 2 hours.");
      return;
    }

    const selectedRoom = rooms.find(
      (room) => room.room_number.toLowerCase() === newRoomNumber.toLowerCase()
    );

    if (!selectedRoom) {
      alert("Room not found.");
      return;
    }

    const { data: conflicts } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", newDate)
      .eq("room_id", selectedRoom.id)
      .neq("id", booking.id);

    const hasConflict =
      conflicts?.some((existing) =>
        overlaps(existing.start_time, existing.end_time, newStart, newEnd)
      ) || false;

    if (hasConflict) {
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
        room_id: selectedRoom.id,
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
            <>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border rounded-lg px-4 py-2"
              />

              <select
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  const currentEnd = timeToMinutes(endTime);
                  const newStart = timeToMinutes(e.target.value);
                  if (currentEnd <= newStart || currentEnd - newStart > 120) {
                    setEndTime(endTimes[times.indexOf(e.target.value)]);
                  }
                }}
                className="border rounded-lg px-4 py-2"
              >
                {times.map((time) => (
                  <option key={time} value={time}>
                    Start {time}
                  </option>
                ))}
              </select>

              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border rounded-lg px-4 py-2"
              >
                {endTimes
                  .filter((time) => {
                    const diff = minutesBetween(startTime, time);
                    return diff >= 30 && diff <= 120;
                  })
                  .map((time) => (
                    <option key={time} value={time}>
                      End {time}
                    </option>
                  ))}
              </select>
            </>
          )}
        </div>

        {view === "booking" && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-left border-b">Room</th>

                  {times.map((time) => (
                    <th key={time} className="p-4 text-sm font-medium border-b">
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

                      return (
                        <td key={time} className="border-b p-2">
                          <button
                            disabled={booked}
                            onClick={() => {
                              if (booked) return;

                              const confirmed = window.confirm(
                                `Confirm booking for ${room.room_number} from ${startTime} to ${endTime}?`
                              );

                              if (confirmed) {
                                bookRoom(room.id);
                              }
                            }}
                            className={
                              booked
                                ? "bg-gray-300 text-gray-600 px-3 py-2 rounded cursor-not-allowed border w-full h-12"
                                : "bg-white hover:bg-gray-100 px-3 py-2 rounded border w-full h-12"
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
                      {booking.booking_date} · {cleanTime(booking.start_time)}–{cleanTime(booking.end_time)}
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
                onChange={(e) => setDate(e.target.value)}
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
                      {booking.booking_date} · {cleanTime(booking.start_time)}–{cleanTime(booking.end_time)}
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

