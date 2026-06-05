"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Classroom = {
  id: string;
  room_number: string;
};

type Booking = {
  id: string;
  classroom_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
};

type UserRole = {
  email: string;
  role: "admin" | "instructor";
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

const times = [
  "09:00","09:30",
  "10:00","10:30",
  "11:00","11:30",
  "12:00","12:30",
  "13:00","13:30",
  "14:00","14:30",
  "15:00","15:30",
  "16:00","16:30",
  "17:00","17:30",
  "18:00","18:30",
  "19:00","19:30",
  "20:00","20:30",
];

function localToday() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(
    2,
    "0"
  )}:${String(total % 60).padStart(2, "0")}`;
}

function cellEnd(time: string) {
  return minutesToTime(timeToMinutes(time) + 30);
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(aEnd) > timeToMinutes(bStart)
  );
}

export default function ClassroomPage() {
  const [user, setUser] = useState<User | null>(null);

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);

  const [date, setDate] = useState(localToday());

  const [selectedRoom, setSelectedRoom] =
    useState<Classroom | null>(null);

  const [start, setStart] = useState("");
  const [hover, setHover] = useState("");

  const currentRole = user?.email
    ? roles.find(
        (r) => r.email.toLowerCase() === user.email?.toLowerCase()
      )?.role
    : undefined;

  const isBackupAdmin = user?.email
    ? backupAdminEmails.includes(user.email.toLowerCase())
    : false;

  const isAdmin = currentRole === "admin" || isBackupAdmin;

  const isInstructor =
    currentRole === "instructor";

  const allowed = isAdmin || isInstructor;

  async function loadData() {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("*");

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

    setBookings(bookingData || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user || null);
      });

    return () =>
      listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadData();
  }, [date, user?.email]);

  function isBooked(roomId: string, time: string) {
    const end = cellEnd(time);

    return bookings.some(
      (b) =>
        b.classroom_id === roomId &&
        overlaps(b.start_time, b.end_time, time, end)
    );
  }

  function isPreview(roomId: string, time: string) {
    if (!selectedRoom || !hover) return false;

    if (selectedRoom.id !== roomId) return false;

    const end = cellEnd(hover);

    return (
      timeToMinutes(time) >= timeToMinutes(start) &&
      timeToMinutes(time) < timeToMinutes(end)
    );
  }

  async function handleClick(
    room: Classroom,
    time: string
  ) {
    if (!allowed) {
      alert(
        "Only instructors/admins can book classrooms."
      );
      return;
    }

    if (isBooked(room.id, time)) return;

    if (!selectedRoom || selectedRoom.id !== room.id) {
      setSelectedRoom(room);
      setStart(time);
      setHover(time);
      return;
    }

    if (timeToMinutes(time) < timeToMinutes(start)) {
      setStart(time);
      setHover(time);
      return;
    }

    const end = cellEnd(time);

    const conflict = bookings.some(
      (b) =>
        b.classroom_id === room.id &&
        overlaps(b.start_time, b.end_time, start, end)
    );

    if (conflict) {
      alert("Already booked.");
      return;
    }

    const confirmed = window.confirm(
      `Book ${room.room_number} from ${start} to ${end}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_bookings")
      .insert({
        classroom_id: room.id,
        booking_date: date,
        start_time: start,
        end_time: end,
        user_email: user?.email,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedRoom(null);
    setStart("");
    setHover("");

    await loadData();

    alert("Booked.");
  }

  async function cancelBooking(id: string) {
    const confirmed = window.confirm(
      "Cancel this booking?"
    );

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
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg border p-8">
          <h1 className="text-3xl font-bold mb-4">
            Access Denied
          </h1>

          <p className="text-gray-600 mb-6">
            Only instructors and admins can
            access classroom booking.
          </p>

          <button
            onClick={() =>
              (window.location.href = "/")
            }
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Back
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
            Instructor/Admin Access
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">

          <button
            onClick={() =>
              (window.location.href = "/")
            }
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Practice Rooms
          </button>

          <input
            type="date"
            value={date}
            min={localToday()}
            onChange={(e) =>
              setDate(e.target.value)
            }
            className="border rounded-lg px-4 py-2 ml-auto"
          />

        </div>

        <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border">

          <table className="w-full border-collapse text-center">

            <thead>
              <tr className="bg-gray-50">

                <th className="p-4 text-left border-b">
                  Classroom
                </th>

                {times.map((time) => (
                  <th
                    key={time}
                    className="p-3 text-sm font-medium border-b"
                  >
                    {time}
                  </th>
                ))}

              </tr>
            </thead>

            <tbody>

              {classrooms.map((room) => (
                <tr key={room.id}>

                  <td className="p-4 border-b font-semibold bg-gray-50">
                    {room.room_number}
                  </td>

                  {times.map((time) => {

                    const booked =
                      isBooked(room.id, time);

                    const preview =
                      isPreview(room.id, time);

                    return (
                      <td key={time} className="border-b p-0">

                        <button
                          disabled={booked}

                          onMouseEnter={() => {
                            if (
                              selectedRoom?.id === room.id
                            ) {
                              setHover(time);
                            }
                          }}

                          onClick={() =>
                            handleClick(room, time)
                          }

                          className={
                            booked
                              ? "bg-gray-300 text-gray-600 w-full h-8 cursor-not-allowed border border-gray-300"
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

          <h2 className="text-3xl font-bold mb-6">
            Classroom Bookings
          </h2>

          {bookings.length === 0 && (
            <p className="text-gray-600">
              No classroom bookings.
            </p>
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
                      classrooms.find(
                        (r) =>
                          r.id === booking.classroom_id
                      )?.room_number
                    }
                  </p>

                  <p className="text-gray-600">
                    {booking.booking_date} ·{" "}
                    {cleanTime(booking.start_time)}–
                    {cleanTime(booking.end_time)}
                  </p>

                  <p className="text-gray-500 text-sm">
                    {booking.user_email}
                  </p>

                </div>

                <button
                  onClick={() =>
                    cancelBooking(booking.id)
                  }
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
