"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Classroom = {
  id: string;
  room_number: string;
  description?: string | null;
};

type ClassroomBooking = {
  id: string;
  classroom_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  remark?: string | null;
  recurring_series_id?: string | null;
};

type UserRole = {
  id?: string;
  email: string;
  role: "admin" | "instructor";
};

type Selection = {
  room: Classroom;
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

function bookingEnded(booking: ClassroomBooking) {
  const today = localToday();

  if (booking.booking_date < today) return true;
  if (booking.booking_date > today) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return timeToMinutes(booking.end_time) <= current;
}

export default function ClassroomsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<ClassroomBooking[]>([]);
  const [myBookings, setMyBookings] = useState<ClassroomBooking[]>([]);
  const [adminBookings, setAdminBookings] = useState<ClassroomBooking[]>([]);

  const [date, setDate] = useState(localToday());
  const [view, setView] = useState<"booking" | "myBookings" | "admin">("booking");

  const [selection, setSelection] = useState<Selection>(null);
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
  const allowed = isAdmin || isInstructor;

  async function loadData() {
    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: classroomData } = await supabase
      .from("classrooms")
      .select("*")
      .order("room_number");

    const defaultRooms = [
      { id: "435", room_number: "435" },
      { id: "519", room_number: "519" },
      { id: "522", room_number: "522" },
      { id: "524", room_number: "524" },
      { id: "526", room_number: "526" },
    ];

    setClassrooms(classroomData && classroomData.length > 0 ? classroomData : defaultRooms);

    const { data: bookingData } = await supabase
      .from("classroom_bookings")
      .select("*")
      .eq("booking_date", date);

    setBookings((bookingData || []).filter((b) => !bookingEnded(b)));

    if (user?.email) {
      const { data: mine } = await supabase
        .from("classroom_bookings")
        .select("*")
        .eq("user_email", user.email)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      setMyBookings((mine || []).filter((b) => !bookingEnded(b)));
    }

    if (allowed) {
      const { data: all } = await supabase
        .from("classroom_bookings")
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

  function classroomName(id: string) {
    return classrooms.find((room) => room.id === id)?.room_number || id;
  }

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

  async function handleCellClick(room: Classroom, time: string) {
    if (!user) {
      alert("Please log in first.");
      return;
    }

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
      await loadData();
      return;
    }

    const remark = window.prompt("Optional note/remark for this classroom booking:", "") || "";

    const confirmed = window.confirm(`Book classroom ${room.room_number} from ${start} to ${end}?`);
    if (!confirmed) return;

    const { error } = await supabase.from("classroom_bookings").insert({
      classroom_id: room.id,
      booking_date: date,
      start_time: start,
      end_time: end,
      user_email: user.email,
      remark,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSelection(null);
    setHoverTime(null);
    await loadData();
    
    await fetch("/api/send-booking-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "confirm",
        email: user.email,
        room: room.room_number,
        date: date,
        startTime: start,
        endTime: end,
      }),
    });
    alert("Classroom booked.");
  }

  async function cancelBooking(id: string, ownerEmail?: string) {
    if (!isAdmin && ownerEmail && ownerEmail !== user?.email) {
      alert("You can only cancel your own classroom booking.");
      return;
    }

    const confirmed = window.confirm("Cancel this classroom booking?");
    if (!confirmed) return;

    const { error } = await supabase.from("classroom_bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Cancelled.");
  }

  async function cancelSeries(seriesId: string) {
    const confirmed = window.confirm("Cancel all classroom bookings in this recurring series?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("classroom_bookings")
      .delete()
      .eq("recurring_series_id", seriesId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Recurring classroom series cancelled.");
  }

  async function updateClassroomDescription(room: Classroom) {
    if (!isAdmin) return;

    const description = window.prompt(
      `Description for classroom ${room.room_number}:`,
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

  async function createRecurringBooking() {
    if (!allowed) {
      alert("Only instructors/admins can create recurring classroom bookings.");
      return;
    }

    const response = await fetch("/api/recurring-classroom-booking", {
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

  async function loginWithGoogle() {
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
          <p className="text-gray-600 mb-6">Instructor/Admin access only.</p><button
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
              Classroom Reservation
            </h1>

            <p className="text-gray-600 mt-2">
              Classrooms 435, 519, 522, 524, 526 · Instructor/Admin access only
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

          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">{selection && ({booking.recurring_series_id && ({booking.recurring_series_id && (
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
          )}
        </div>
      </main>
    </>
  );
}
