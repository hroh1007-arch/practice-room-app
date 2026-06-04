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
  "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00",
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [view, setView] = useState<"booking" | "myBookings">("booking");

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
      !currentUser.email?.endsWith("@tc.columbia.edu") &&
      !currentUser.email?.endsWith("@columbia.edu")
    ) {
      await supabase.auth.signOut();
      alert("Only Columbia or TC Columbia Google accounts are allowed.");
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
  }

  function isBooked(roomId: string, time: string) {
    return bookings.some(
      (booking) =>
        booking.room_id === roomId &&
        booking.start_time === time
    );
  }

  function roomName(roomId: string) {
    return rooms.find((room) => room.id === roomId)?.room_number || "Room";
  }

  async function bookRoom(roomId: string, startTime: string) {
    if (!user) {
      alert("Please log in with your Columbia Google account before booking.");
      return;
    }

    const endHour = String(Number(startTime.split(":")[0]) + 1).padStart(2, "0");
    const endTime = `${endHour}:00`;

    const conflict = bookings.find(
      (booking) =>
        booking.room_id === roomId &&
        booking.start_time === startTime
    );

    if (conflict) {
      alert("This room is already booked.");
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      user_id: user.id,
      user_email: user.email,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Booking confirmed!");
      loadData();
    }
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
      loadData();
    }
  }

  async function modifyBooking(booking: Booking) {
    const newDate = prompt("New date, format YYYY-MM-DD:", booking.booking_date);
    if (!newDate) return;

    const newRoomNumber = prompt("New room, example 515A:", roomName(booking.room_id));
    if (!newRoomNumber) return;

    const newTime = prompt("New start time, example 14:00:", booking.start_time);
    if (!newTime) return;

    const selectedRoom = rooms.find(
      (room) => room.room_number.toLowerCase() === newRoomNumber.toLowerCase()
    );

    if (!selectedRoom) {
      alert("Room not found.");
      return;
    }

    const endHour = String(Number(newTime.split(":")[0]) + 1).padStart(2, "0");
    const newEndTime = `${endHour}:00`;

    const { data: conflicts } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", newDate)
      .eq("room_id", selectedRoom.id)
      .eq("start_time", newTime)
      .neq("id", booking.id);

    if (conflicts && conflicts.length > 0) {
      alert("That new slot is already booked.");
      return;
    }

    const confirmed = window.confirm(
      `Change booking to ${newRoomNumber} on ${newDate} at ${newTime}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .update({
        room_id: selectedRoom.id,
        booking_date: newDate,
        start_time: newTime,
        end_time: newEndTime,
      })
      .eq("id", booking.id)
      .eq("user_email", user?.email);

    if (error) {
      alert(error.message);
    } else {
      alert("Booking updated.");
      loadData();
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

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center">
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
              Continue with Columbia Google
            </button>
          )}

          {view === "booking" && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
                      const booked = isBooked(room.id, time);

                      return (
                        <td key={time} className="border-b p-2">
                          <button
                            onClick={() => {
                              if (booked) return;

                              const confirmed = window.confirm(
                                `Confirm booking for ${room.room_number} at ${time}?`
                              );

                              if (confirmed) {
                                bookRoom(room.id, time);
                              }
                            }}
                            className={
                              booked
                                ? "bg-gray-300 text-gray-500 px-3 py-2 rounded cursor-not-allowed border w-full h-12"
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

            {!user && (
              <p className="text-gray-600">
                Please log in to view your bookings.
              </p>
            )}

            {user && myBookings.length === 0 && (
              <p className="text-gray-600">
                You do not have any bookings yet.
              </p>
            )}

            {user && myBookings.length > 0 && (
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
                        {booking.booking_date} · {booking.start_time}–
                        {booking.end_time}
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
            )}
          </div>
        )}
      </div>
    </main>
  );
}
