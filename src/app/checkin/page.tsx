"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Booking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  checked_in: boolean;
};

type Room = {
  id: string;
  room_number: string;
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

export default function CheckInPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [message, setMessage] = useState("Loading check-in page...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room") || "";
    setRoomNumber(room);

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setMessage("Ready to check in.");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
  }

  async function checkIn() {
    if (!user?.email) {
      alert("Please log in first.");
      return;
    }

    if (!roomNumber) {
      alert("Missing room number.");
      return;
    }

    const { data: rooms } = await supabase
      .from("practice_rooms")
      .select("*")
      .eq("room_number", roomNumber);

    const room = rooms?.[0] as Room | undefined;

    if (!room) {
      setMessage("Room not found.");
      return;
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("room_id", room.id)
      .eq("booking_date", today())
      .eq("user_email", user.email);

    const now = nowMinutes();

    const matchingBooking = (bookings || []).find((booking: Booking) => {
      const start = timeToMinutes(booking.start_time);
      const end = timeToMinutes(booking.end_time);

      return now >= start - 10 && now <= end;
    }) as Booking | undefined;

    if (!matchingBooking) {
      setMessage("No active booking found for this room under your account.");
      return;
    }

    if (matchingBooking.checked_in) {
      setMessage("You are already checked in.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", matchingBooking.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      `Checked in successfully for Room ${roomNumber}, ${cleanTime(
        matchingBooking.start_time
      )}–${cleanTime(matchingBooking.end_time)}.`
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
      <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <h1 className="text-4xl font-bold mb-4">Room Check-In</h1>

        <p className="text-gray-600 mb-6">
          Room: <strong>{roomNumber || "Unknown"}</strong>
        </p>

        {user ? (
          <>
            <p className="text-gray-700 mb-4">
              Logged in as <strong>{user.email}</strong>
            </p>

            <button
              onClick={checkIn}
              className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
            >
              Check In
            </button>
          </>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Log in with TC/CU Google
          </button>
        )}

        <p className="mt-6 text-gray-700">{message}</p>
      </div>
    </main>
  );
}
