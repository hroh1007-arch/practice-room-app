"use client";

import { useEffect, useState, type ReactNode } from "react";
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

type BookingDraft = {
  room: Classroom;
  start: string;
  end: string;
  bookeeEmail: string;
  instructor: string;
  courseName: string;
  courseCode: string;
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

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
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
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(null);

  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringRoom, setRecurringRoom] = useState("");
  const [recurringStartDate, setRecurringStartDate] = useState(localToday());
  const [recurringEndDate, setRecurringEndDate] = useState(localToday());
  const [recurringWeekday, setRecurringWeekday] = useState("1");
  const [recurringStartTime, setRecurringStartTime] = useState("09:00");
  const [recurringEndTime, setRecurringEndTime] = useState("10:00");
  const [recurringBookeeEmail, setRecurringBookeeEmail] = useState("");
  const [recurringInstructor, setRecurringInstructor] = useState("");
  const [recurringCourseName, setRecurringCourseName] = useState("");
  const [recurringCourseCode, setRecurringCourseCode] = useState("");

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

    setClassrooms(classroomData || []);

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

  function bookingForCell(roomId: string, time: string) {
    const end = cellEnd(time);

    return bookings.find(
      (b) =>
        b.classroom_id === roomId &&
        overlaps(b.start_time, b.end_time, time, end) &&
        !bookingEnded(b)
    );
  }

  function isBooked(roomId: string, time: string) {
    return Boolean(bookingForCell(roomId, time));
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

    setBookingDraft({
      room,
      start,
      end,
      bookeeEmail: user.email || "",
      instructor: "",
      courseName: "",
      courseCode: "",
    });
  }

  async function confirmBookingDraft() {
    if (!user || !bookingDraft) return;

    const bookeeEmail = (isAdmin ? bookingDraft.bookeeEmail : user.email || "")
      .trim()
      .toLowerCase();

    if (!bookeeEmail) {
      alert("Bookee email is required.");
      return;
    }

    const remark = [
      bookingDraft.instructor && `Instructor: ${bookingDraft.instructor}`,
      bookingDraft.courseName && `Course: ${bookingDraft.courseName}`,
      bookingDraft.courseCode && `Code: ${bookingDraft.courseCode}`,
    ]
      .filter(Boolean)
      .join(" / ");

    const { error } = await supabase.from("classroom_bookings").insert({
      classroom_id: bookingDraft.room.id,
      booking_date: date,
      start_time: bookingDraft.start,
      end_time: bookingDraft.end,
      user_email: bookeeEmail,
      remark,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await fetch("/api/send-booking-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "confirm",
        email: bookeeEmail,
        room: bookingDraft.room.room_number,
        date,
        startTime: bookingDraft.start,
        endTime: bookingDraft.end,
      }),
    });

    setBookingDraft(null);
    setSelection(null);
    setHoverTime(null);
    await loadData();

    alert("Classroom booked.");
  }

  async function cancelBooking(id: string, ownerEmail?: string) {
    const bookingToCancel = myBookings.find((booking) => booking.id === id) || adminBookings.find((booking) => booking.id === id);

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

    if (bookingToCancel) {
      await fetch("/api/send-booking-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "cancel",
          email: bookingToCancel.user_email,
          room: classroomName(bookingToCancel.classroom_id),
          date: bookingToCancel.booking_date,
          startTime: cleanTime(bookingToCancel.start_time),
          endTime: cleanTime(bookingToCancel.end_time),
        }),
      });
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

    const bookeeEmail = (isAdmin ? recurringBookeeEmail : user?.email || "")
      .trim()
      .toLowerCase();

    if (!bookeeEmail) {
      alert("Bookee email is required.");
      return;
    }

    const remark = [
      recurringInstructor && `Instructor: ${recurringInstructor}`,
      recurringCourseName && `Course: ${recurringCourseName}`,
      recurringCourseCode && `Code: ${recurringCourseCode}`,
    ]
      .filter(Boolean)
      .join(" / ");

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
        remark,
        email: bookeeEmail,
      }),
    });

    const data = await response.json();
    alert(data.message);

    setShowRecurringModal(false);
    setRecurringBookeeEmail("");
    setRecurringInstructor("");
    setRecurringCourseName("");
    setRecurringCourseCode("");
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
          <p className="text-gray-600 mb-6">Instructor/Admin access only.</p>

          <button
            onClick={loginWithGoogle}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Continue with TC/CU Google
          </button>



          <button
            onClick={() => (window.location.href = "/practice")}
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
            onClick={() => (window.location.href = "/practice")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full"
          >
            Back to Practice Rooms
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {bookingDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold">Confirm Classroom Booking</h2>

            <p className="text-gray-600">
              Classroom {bookingDraft.room.room_number} · {date} · {bookingDraft.start}-{bookingDraft.end}
            </p>

            <div>
              <label className="block text-sm font-semibold mb-1">Book for email</label>
              <input
                value={bookingDraft.bookeeEmail}
                disabled={!isAdmin}
                onChange={(e) =>
                  setBookingDraft({ ...bookingDraft, bookeeEmail: e.target.value })
                }
                className="border rounded-lg px-4 py-2 w-full disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Instructor</label>
              <input
                value={bookingDraft.instructor}
                onChange={(e) =>
                  setBookingDraft({ ...bookingDraft, instructor: e.target.value })
                }
                className="border rounded-lg px-4 py-2 w-full"
                placeholder="Instructor name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Course Name</label>
              <input
                value={bookingDraft.courseName}
                onChange={(e) =>
                  setBookingDraft({ ...bookingDraft, courseName: e.target.value })
                }
                className="border rounded-lg px-4 py-2 w-full"
                placeholder="Course name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Course Code</label>
              <input
                value={bookingDraft.courseCode}
                onChange={(e) =>
                  setBookingDraft({ ...bookingDraft, courseCode: e.target.value })
                }
                className="border rounded-lg px-4 py-2 w-full"
                placeholder="Course code"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setBookingDraft(null);
                  setSelection(null);
                  setHoverTime(null);
                }}
                className="border px-4 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={confirmBookingDraft}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-2xl font-bold">Recurring Bookingss</h2>

            <input
              placeholder="Classroom Number"
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

            <div>
              <label className="text-sm">Book for email</label>
              <input
                value={recurringBookeeEmail}
                disabled={!isAdmin}
                onChange={(e) => setRecurringBookeeEmail(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="text-sm">Instructor</label>
              <input
                value={recurringInstructor}
                onChange={(e) => setRecurringInstructor(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Instructor name"
              />
            </div>

            <div>
              <label className="text-sm">Course Name</label>
              <input
                value={recurringCourseName}
                onChange={(e) => setRecurringCourseName(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Course name"
              />
            </div>

            <div>
              <label className="text-sm">Course Code</label>
              <input
                value={recurringCourseCode}
                onChange={(e) => setRecurringCourseCode(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Course code"
              />
            </div>

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

          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
            <button
              onClick={() => (window.location.href = "/")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Main Menu
            </button>

            <button
              onClick={() => (window.location.href = "/practice")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Practice Rooms
            </button>

            <button
              onClick={() => (window.location.href = "/classrooms")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Classrooms
            </button>

            <button
              onClick={() => (window.location.href = "/equipment")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Equipment
            </button>

            <button
              onClick={() => {
                setRecurringBookeeEmail(user?.email || "");
                setShowRecurringModal(true);
              }}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Recurring Bookings
            </button>

            <button
              onClick={() => (window.location.href = "/my-bookings")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              My Bookings
            </button>

            {isAdmin && (
              <button
                onClick={() => (window.location.href = "/admin-bookings")}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Admin
              </button>
            )}

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

          {view === "booking" && (
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

                      {(() => {
                        const cells: ReactNode[] = [];

                        for (let index = 0; index < times.length; index++) {
                          const time = times[index];
                          const booking = bookingForCell(room.id, time);
                          const preview = isPreview(room.id, time);
                          const past = isPastTime(date, time);

                          if (booking) {
                            if (cleanTime(booking.start_time) !== time) {
                              continue;
                            }

                            const colSpan = Math.max(
                              1,
                              Math.min(
                                Math.ceil(minutesBetween(booking.start_time, booking.end_time) / 30),
                                times.length - index
                              )
                            );

                            cells.push(
                              <td key={booking.id} colSpan={colSpan} className="border-b p-0">
                                <div
                                  title={[booking.user_email.split("@")[0], booking.remark].filter(Boolean).join(" · ")}
                                  className="bg-gray-300 text-gray-600 w-full h-8 border border-gray-300 text-xs overflow-hidden whitespace-nowrap px-2 flex items-center justify-center"
                                >
                                  {[booking.user_email.split("@")[0], booking.remark].filter(Boolean).join(" · ")}
                                </div>
                              </td>
                            );

                            continue;
                          }

                          cells.push(
                            <td key={time} className="border-b p-0">
                              <button
                                disabled={past || isPastDate(date)}
                                onMouseEnter={() => {
                                  if (selection?.room.id === room.id) {
                                    setHoverTime(time);
                                  }
                                }}
                                onClick={() => handleCellClick(room, time)}
                                className={
                                  past || isPastDate(date)
                                    ? "bg-gray-100 text-gray-400 w-full h-8 cursor-not-allowed border border-gray-200 text-xs"
                                    : preview
                                    ? "bg-gray-200 w-full h-8 border border-gray-300 text-xs"
                                    : "bg-white hover:bg-gray-100 w-full h-8 border border-gray-300 text-xs"
                                }
                              />
                            </td>
                          );
                        }

                        return cells;
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === "myBookings" && (
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-3xl font-bold mb-6">My Classroom Bookings</h2>

              {myBookings.length === 0 && (
                <p className="text-gray-600">No active classroom bookings.</p>
              )}

              <div className="space-y-4">
                {myBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-lg">
                        {classroomName(booking.classroom_id)}
                      </p>

                      <p className="text-gray-600">
                        {booking.booking_date} · {cleanTime(booking.start_time)}–
                        {cleanTime(booking.end_time)}
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
                        onClick={() => cancelBooking(booking.id, booking.user_email)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>

                      {booking.recurring_series_id && (
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

          {view === "admin" && (
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-3xl font-bold mb-6">Admin Classroom Bookings</h2>

              {adminBookings.length === 0 && (
                <p className="text-gray-600">No active classroom bookings.</p>
              )}

              <div className="space-y-4">
                {adminBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-lg">
                        {classroomName(booking.classroom_id)}
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
                        onClick={() => cancelBooking(booking.id, booking.user_email)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>

                      {booking.recurring_series_id && (
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
