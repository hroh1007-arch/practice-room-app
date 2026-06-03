"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Room = {
  id: string;
  room_number: string;
};

type Booking = {
  id: string;
  room_id: string;
  student_name: string;
  student_email: string;
  booking_date: string;
  start_time: string;
  end_time: string;
};

const times = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);

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
  }

  useEffect(() => {
    loadData();
  }, [date]);

  async function bookRoom(roomId: string, startTime: string) {
    const name = prompt("Enter your name");
    const email = prompt("Enter your email");

    if (!name || !email) return;

    const endHour = String(
      Number(startTime.split(":")[0]) + 1
    ).padStart(2, "0");

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
      student_name: name,
      student_email: email,
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

  function isBooked(roomId: string, time: string) {
    return bookings.some(
      (booking) =>
        booking.room_id === roomId &&
        booking.start_time === time
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-4xl font-bold mb-6">
        Practice Room Booking
      </h1>

      <div className="mb-6">
        <label className="mr-3 font-semibold">
          Select Date:
        </label>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse border w-full text-center">
          <thead>
            <tr>
              <th className="border p-3 bg-gray-100">
                Room
              </th>

              {times.map((time) => (
                <th
                  key={time}
                  className="border p-3 bg-gray-100"
                >
                  {time}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="border p-3 font-bold">
                  {room.room_number}
                </td>

                {times.map((time) => {
                  const booked = isBooked(room.id, time);

                  return (
                    <td
                      key={time}
                      className="border p-2"
                    >
                      <button
                        onClick={() =>
                          !booked &&
                          bookRoom(room.id, time)
                        }
                        className={
                          booked
                            ? "bg-red-500 text-white px-3 py-2 rounded cursor-not-allowed"
                            : "bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600"
                        }
                      >
                        {booked ? "Booked" : "Book"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

