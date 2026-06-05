```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Room = {
  id: string;
  room_number: string;
};

type Booking = {
  id: string;
  room_number: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  remark?: string;
  recurring_series_id?: string;
};

const times = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
];

export default function HomePage() {

  const [user, setUser] = useState<any>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [showRecurringModal, setShowRecurringModal] =
    useState(false);

  const [recurringRoom, setRecurringRoom] =
    useState("");

  const [recurringStartDate,
    setRecurringStartDate] =
    useState(date);

  const [recurringEndDate,
    setRecurringEndDate] =
    useState(date);

  const [recurringWeekday,
    setRecurringWeekday] =
    useState("1");

  const [recurringStartTime,
    setRecurringStartTime] =
    useState("09:00");

  const [recurringEndTime,
    setRecurringEndTime] =
    useState("10:00");

  const [recurringRemark,
    setRecurringRemark] =
    useState("");

  const instructorEmails = [
    "hh3144@tc.columbia.edu",
  ];

  const adminEmails = [
    "hh3144@tc.columbia.edu",
  ];

  const isInstructor =
    user?.email &&
    instructorEmails.includes(
      user.email.toLowerCase()
    );

  const isAdmin =
    user?.email &&
    adminEmails.includes(
      user.email.toLowerCase()
    );

  const hasUnlimitedBooking =
    isInstructor || isAdmin;

  async function loadData() {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    const { data: roomsData } =
      await supabase
        .from("practice_rooms")
        .select("*")
        .order("room_number");

    setRooms(roomsData || []);

    const { data: bookingsData } =
      await supabase
        .from("bookings")
        .select("*")
        .eq("booking_date", date);

    setBookings(bookingsData || []);
  }

  useEffect(() => {
    loadData();
  }, [date]);

  async function login() {

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          window.location.origin,
      },
    });
  }

  async function logout() {

    await supabase.auth.signOut();

    location.reload();
  }

  function isBooked(
    room: string,
    time: string
  ) {

    return bookings.find(
      (b) =>
        b.room_number === room &&
        b.start_time <= time &&
        b.end_time > time
    );
  }

  async function createBooking(
    room: string,
    start: string
  ) {

    if (!user) {
      alert("Login first");
      return;
    }

    const roomNumber =
      room.toUpperCase();

    if (
      roomNumber === "515I"
    ) {
      alert("515I cannot be booked.");
      return;
    }

    if (
      roomNumber === "515K" &&
      !hasUnlimitedBooking
    ) {
      alert(
        "515K is only for instructors/admin."
      );
      return;
    }

    const end =
      times[
        times.indexOf(start) + 1
      ];

    if (!end) return;

    const existing =
      bookings.find(
        (b) =>
          b.room_number === room &&
          b.start_time < end &&
          b.end_time > start
      );

    if (existing) {
      alert("Already booked.");
      return;
    }

    const remark =
      prompt("Remark / Note") || "";

    await supabase
      .from("bookings")
      .insert({
        room_number: room,
        booking_date: date,
        start_time: start,
        end_time: end,
        user_email: user.email,
        remark,
      });

    loadData();
  }

  return (
    <>
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">

            <h2 className="text-2xl font-bold">
              Recurring Booking
            </h2>

            <input
              placeholder="Room Number"
              value={recurringRoom}
              onChange={(e) =>
                setRecurringRoom(
                  e.target.value
                )
              }
              className="border rounded-lg px-3 py-2 w-full"
            />

            <div>
              <label className="text-sm">
                Start Date
              </label>

              <input
                type="date"
                value={
                  recurringStartDate
                }
                onChange={(e) =>
                  setRecurringStartDate(
                    e.target.value
                  )
                }
                className="border rounded-lg px-3 py-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm">
                End Date
              </label>

              <input
                type="date"
                value={
                  recurringEndDate
                }
                onChange={(e) =>
                  setRecurringEndDate(
                    e.target.value
                  )
                }
                className="border rounded-lg px-3 py-2 w-full"
              />
            </div>

            <div>
              <label className="text-sm">
                Repeat Day
              </label>

              <select
                value={
                  recurringWeekday
                }
                onChange={(e) =>
                  setRecurringWeekday(
                    e.target.value
                  )
                }
                className="border rounded-lg px-3 py-2 w-full"
              >
                <option value="1">
                  Monday
                </option>

                <option value="2">
                  Tuesday
                </option>

                <option value="3">
                  Wednesday
                </option>

                <option value="4">
                  Thursday
                </option>

                <option value="5">
                  Friday
                </option>
              </select>
            </div>

            <div className="flex gap-2">

              <div className="flex-1">
                <label className="text-sm">
                  Start Time
                </label>

                <input
                  type="time"
                  value={
                    recurringStartTime
                  }
                  onChange={(e) =>
                    setRecurringStartTime(
                      e.target.value
                    )
                  }
                  className="border rounded-lg px-3 py-2 w-full"
                />
              </div>

              <div className="flex-1">
                <label className="text-sm">
                  End Time
                </label>

                <input
                  type="time"
                  value={
                    recurringEndTime
                  }
                  onChange={(e) =>
                    setRecurringEndTime(
                      e.target.value
                    )
                  }
                  className="border rounded-lg px-3 py-2 w-full"
                />
              </div>

            </div>

            <textarea
              placeholder="Remark / Notes"
              value={recurringRemark}
              onChange={(e) =>
                setRecurringRemark(
                  e.target.value
                )
              }
              className="border rounded-lg px-3 py-2 w-full"
            />

            <div className="flex gap-2 justify-end">

              <button
                onClick={() =>
                  setShowRecurringModal(
                    false
                  )
                }
                className="border px-4 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={async () => {

                  const response =
                    await fetch(
                      "/api/recurring-booking",
                      {
                        method:
                          "POST",

                        headers: {
                          "Content-Type":
                            "application/json",
                        },

                        body:
                          JSON.stringify({
                            room:
                              recurringRoom,

                            startDate:
                              recurringStartDate,

                            endDate:
                              recurringEndDate,

                            weekday:
                              recurringWeekday,

                            startTime:
                              recurringStartTime,

                            endTime:
                              recurringEndTime,

                            remark:
                              recurringRemark,

                            email:
                              user?.email,
                          }),
                      }
                    );

                  const data =
                    await response.json();

                  alert(
                    data.message
                  );

                  loadData();

                  setShowRecurringModal(
                    false
                  );
                }}
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

          </div>

          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">

            {user ? (
              <>

                <span className="text-gray-700">
                  Logged in as{" "}
                  <strong>
                    {user.email}
                  </strong>
                </span>

                <button
                  onClick={logout}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Log out
                </button>

                {hasUnlimitedBooking && (
                  <button
                    onClick={() =>
                      setShowRecurringModal(
                        true
                      )
                    }
                    className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                  >
                    Recurring Booking
                  </button>
                )}

              </>
            ) : (
              <button
                onClick={login}
                className="bg-black text-white px-5 py-2 rounded-lg"
              >
                Continue with TC/CU Google
              </button>
            )}

            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(
                  e.target.value
                )
              }
              className="border rounded-lg px-4 py-2 ml-auto"
            />

          </div>

          <div className="overflow-auto bg-white rounded-xl border shadow-sm">

            <table className="min-w-full border-collapse">

              <thead>

                <tr>

                  <th className="border p-3 bg-gray-50">
                    Room
                  </th>

                  {times.map((t) => (
                    <th
                      key={t}
                      className="border p-3 text-sm bg-gray-50"
                    >
                      {t}
                    </th>
                  ))}

                </tr>

              </thead>

              <tbody>

                {rooms.map((room) => (

                  <tr
                    key={room.id}
                  >

                    <td className="border p-3 font-medium bg-gray-50">
                      {room.room_number}
                    </td>

                    {times.map((time) => {

                      const booking =
                        isBooked(
                          room.room_number,
                          time
                        );

                      return (
                        <td
                          key={time}
                          onClick={() =>
                            !booking &&
                            createBooking(
                              room.room_number,
                              time
                            )
                          }
                          className={`border p-2 text-center cursor-pointer text-sm
                          ${
                            booking
                              ? "bg-red-200"
                              : "hover:bg-green-100"
                          }`}
                        >
                          {booking
                            ? booking.user_email.split(
                                "@"
                              )[0]
                            : ""}
                        </td>
                      );
                    })}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      </main>
    </>
  );
}

