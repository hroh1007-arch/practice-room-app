"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Role = {
  email: string;
  role: "admin" | "instructor";
};

type Room = {
  id: string;
  room_number: string;
};

type PracticeBooking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  user_name?: string | null;
  remark?: string | null;
  recurring_series_id?: string | null;
};

type ClassroomBooking = {
  id: string;
  classroom_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  user_name?: string | null;
  remark?: string | null;
  recurring_series_id?: string | null;
};

type EquipmentCheckout = {
  id: string;
  equipment_code: string | null;
  renter_name: string | null;
  uni: string | null;
  email: string | null;
  instructor: string | null;
  checkout_date: string | null;
  return_date: string | null;
  actual_return_date?: string | null;
  returned?: boolean | null;
  notes: string | null;
};

const times = [
  "07:00", "07:30",
  "08:00", "08:30",
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
  "21:00", "21:30",
];


function displayNameFromUser(user: any) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "there"
  );
}

function displayPerson(name?: string | null, email?: string | null) {
  const uni = email ? email.split("@")[0] : "";
  if (name && uni) return `${name} ${uni}`;
  return name || uni || "Unknown";
}

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function cleanTime(time?: string | null) {
  return (time || "").slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function bookingEnded(booking: { booking_date: string; end_time: string }) {
  const nowDate = localToday();

  if (booking.booking_date < nowDate) return true;
  if (booking.booking_date > nowDate) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return timeToMinutes(booking.end_time) <= current;
}

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}

function addDays(date: string, days: number) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

function getWeekDates(selectedDate: string) {
  const dateObj = new Date(selectedDate + "T00:00:00");
  const day = dateObj.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(selectedDate, diffToMonday);

  return Array.from({ length: 5 }, (_, index) => addDays(monday, index));
}

function formatScheduleDate(date: string) {
  const dateObj = new Date(date + "T00:00:00");
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function scheduleBlockColor(index: number) {
  const colors = [
    "bg-blue-600 border-blue-800",
    "bg-red-600 border-red-800",
    "bg-green-600 border-green-800",
    "bg-amber-700 border-amber-900",
    "bg-violet-600 border-violet-800",
  ];

  return colors[index % colors.length];
}

export default function AdminBookingsPage() {
  const [adminView, setAdminView] = useState<"bookings" | "roles" | "suspensions">("bookings");
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [suspensionEmail, setSuspensionEmail] = useState("");
  const [suspensionStart, setSuspensionStart] = useState("");
  const [suspensionEnd, setSuspensionEnd] = useState("");
  const [suspensionReason, setSuspensionReason] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classrooms, setClassrooms] = useState<Room[]>([]);
  const [practiceBookings, setPracticeBookings] = useState<PracticeBooking[]>([]);
  const [classroomBookings, setClassroomBookings] = useState<ClassroomBooking[]>([]);
  const [scheduleClassroomBookings, setScheduleClassroomBookings] = useState<ClassroomBooking[]>([]);
  const [equipmentCheckouts, setEquipmentCheckouts] = useState<EquipmentCheckout[]>([]);
  const [authUserNames, setAuthUserNames] = useState<Record<string, string>>({});
  const [classroomScheduleDate, setClassroomScheduleDate] = useState(localToday());
  const [classroomScheduleMode, setClassroomScheduleMode] = useState<"day" | "week">("day");

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isAdmin =
    currentRole === "admin" ||
    (user?.email ? backupAdminEmails.includes(user.email.toLowerCase()) : false);

  async function loadData(currentUser?: User | null) {
    const activeUser = currentUser || user;

    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: roomData } = await supabase
      .from("practice_rooms")
      .select("id, room_number");

    setRooms(roomData || []);

    const { data: classroomData } = await supabase
      .from("classrooms")
      .select("id, room_number")
      .order("room_number");

    setClassrooms(classroomData || []);

    if (!activeUser?.email) return;

    const { data: practiceData } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    const { data: classroomBookingData } = await supabase
      .from("classroom_bookings")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    const activePracticeBookings = (practiceData || []).filter((b) => !bookingEnded(b));
    const activeClassroomBookings = (classroomBookingData || []).filter((b) => !bookingEnded(b));
    const scheduleBookings = (classroomBookingData || []).filter(
      (booking) => booking.booking_date >= localToday()
    );

    setPracticeBookings(activePracticeBookings);
    setClassroomBookings(activeClassroomBookings);
    setScheduleClassroomBookings(scheduleBookings);
    await loadAuthUserNames([...activePracticeBookings, ...scheduleBookings]);

    const { data: checkoutData } = await supabase
      .from("equipment_checkouts")
      .select("*")
      .eq("returned", false)
      .order("checkout_date", { ascending: true });

    setEquipmentCheckouts(checkoutData || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      loadData(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      loadData(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/admin-bookings",
      },
    });
  }

  function roomName(id: string) {
    return rooms.find((r) => r.id === id)?.room_number || id;
  }

  function classroomName(id: string) {
    return classrooms.find((r) => r.id === id)?.room_number || id;
  }

  function bookingPerson(booking: PracticeBooking | ClassroomBooking) {
    return displayPerson(
      booking.user_name || authUserNames[booking.user_email.toLowerCase()],
      booking.user_email
    );
  }

  function classroomBookingForCell(roomId: string, date: string, time: string) {
    return scheduleClassroomBookings.find(
      (booking) =>
        booking.classroom_id === roomId &&
        booking.booking_date === date &&
        overlaps(booking.start_time, booking.end_time, time, cleanTimeForCellEnd(time))
    );
  }

  function cleanTimeForCellEnd(time: string) {
    const endMinutes = timeToMinutes(time) + 30;
    return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  }

  function classroomBookingsForDate(date: string) {
    return scheduleClassroomBookings.filter((booking) => booking.booking_date === date);
  }

  async function loadAuthUserNames(bookings: Array<PracticeBooking | ClassroomBooking>) {
    const emails = Array.from(
      new Set(
        bookings
          .map((booking) => booking.user_email)
          .filter(Boolean)
          .map((email) => email.toLowerCase())
      )
    );

    if (emails.length === 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) return;

    const response = await fetch("/api/user-display-names", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emails }),
    });

    if (!response.ok) return;

    const data = await response.json();
    setAuthUserNames(data.names || {});
  }

  async function cancelPractice(id: string) {
    if (!confirm("Cancel this practice room booking?")) return;

    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function cancelClassroom(id: string) {
    if (!confirm("Cancel this classroom booking?")) return;

    const { error } = await supabase.from("classroom_bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function returnEquipment(checkout: EquipmentCheckout) {
    const returnDate = prompt("Actual return date:", new Date().toISOString().split("T")[0]);

    if (!returnDate) return;

    const { error } = await supabase
      .from("equipment_checkouts")
      .update({
        returned: true,
        actual_return_date: returnDate,
      })
      .eq("id", checkout.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }


  if (!user) {

    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Admin Bookings</h1>
          <p className="text-gray-600 mb-6">Admin login required.</p>

          <button
            onClick={login}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Continue with TC/CU Google
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full mt-3"
          >
            Back to Main Menu
          </button>
        </div>
      

      {showSuspensionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Suspend User</h2>

            <div className="space-y-3">
              <input
                value={suspensionEmail}
                onChange={(e) => setSuspensionEmail(e.target.value)}
                placeholder="Email"
                className="w-full border rounded-lg px-4 py-2"
              />

              <input
                type="date"
                value={suspensionStart}
                onChange={(e) => setSuspensionStart(e.target.value)}
                className="w-full border rounded-lg px-4 py-2"
              />

              <input
                type="date"
                value={suspensionEnd}
                onChange={(e) => setSuspensionEnd(e.target.value)}
                className="w-full border rounded-lg px-4 py-2"
              />

              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="Reason"
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => (window.location.href = "/admin-suspensions")}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Save Suspension
              </button>

              <button
                onClick={() => setShowSuspensionModal(false)}
                className="border px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

</main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Only admins can view this page.</p>

          <button
            onClick={() => (window.location.href = "/")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full"
          >
            Back to Main Menu
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">Admin Bookings</h1>
          <p className="text-gray-600 mt-2">
            Future practice room and classroom bookings.
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          <button onClick={() => (window.location.href = "/")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Main Menu</button>
          <button onClick={() => (window.location.href = "/practice")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Practice Rooms</button>
          <button onClick={() => (window.location.href = "/classrooms")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Classrooms</button>
          <button onClick={() => (window.location.href = "/equipment")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Equipment</button>
            
            <button
              onClick={() => (window.location.href = "/admin-roles")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Manage Roles
            </button>

            <button
              onClick={() => (window.location.href = "/admin-suspensions")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Suspensions
            </button>


          <span className="text-gray-700 ml-auto">
            Hello <strong>{displayNameFromUser(user)}</strong> · Logged in as <strong>{user.email}</strong>
          </span>
        </div>

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <div className="flex items-center gap-4 flex-wrap mb-5">
            <div>
              <h2 className="text-3xl font-bold">Classroom Schedule</h2>
              <p className="text-gray-600 mt-1">
                Day and week view for classrooms 435, 519, 522, 524, and 526.
              </p>
            </div>

            <div className="ml-auto flex gap-3 items-center flex-wrap">
              <div className="border rounded-lg overflow-hidden flex">
                <button
                  onClick={() => setClassroomScheduleMode("day")}
                  className={
                    classroomScheduleMode === "day"
                      ? "bg-gray-900 text-white px-4 py-2"
                      : "bg-white px-4 py-2 hover:bg-gray-100"
                  }
                >
                  Day
                </button>

                <button
                  onClick={() => setClassroomScheduleMode("week")}
                  className={
                    classroomScheduleMode === "week"
                      ? "bg-gray-900 text-white px-4 py-2"
                      : "bg-white px-4 py-2 hover:bg-gray-100"
                  }
                >
                  Week
                </button>
              </div>

              <input
                type="date"
                value={classroomScheduleDate}
                onChange={(e) => setClassroomScheduleDate(e.target.value)}
                className="border rounded-lg px-4 py-2"
              />
            </div>
          </div>

          {classroomScheduleMode === "day" ? (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full border-collapse text-center text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left border-b min-w-28">
                      {formatScheduleDate(classroomScheduleDate)}
                    </th>

                    {times.map((time) => (
                      <th key={time} className="p-2 border-b font-medium min-w-20">
                        {time}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {classrooms.map((room) => (
                    <tr key={room.id}>
                      <td className="p-3 border-b bg-gray-50 text-left font-semibold">
                        {room.room_number}
                      </td>

                      {(() => {
                        const cells: ReactNode[] = [];

                        for (let index = 0; index < times.length; index++) {
                          const time = times[index];
                          const booking = classroomBookingForCell(
                            room.id,
                            classroomScheduleDate,
                            time
                          );

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
                            const label = [
                              `${cleanTime(booking.start_time)}-${cleanTime(booking.end_time)}`,
                              bookingPerson(booking),
                              booking.remark,
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            cells.push(
                              <td key={booking.id} colSpan={colSpan} className="border-b p-0">
                                <div
                                  title={label}
                                  className="bg-gray-300 text-gray-700 border border-gray-400 text-xs min-h-12 px-2 py-1 flex items-center justify-center overflow-hidden"
                                >
                                  <span className="line-clamp-2">{label}</span>
                                </div>
                              </td>
                            );

                            continue;
                          }

                          cells.push(
                            <td key={time} className="border-b p-0">
                              <div className="bg-white border border-gray-200 h-12" />
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
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <div
                className="relative min-w-[980px] grid text-sm"
                style={{
                  gridTemplateColumns: "72px repeat(5, minmax(170px, 1fr))",
                  gridTemplateRows: `44px repeat(${times.length}, 32px)`,
                }}
              >
                <div className="sticky left-0 z-20 bg-gray-50 border-b border-r" />

                {getWeekDates(classroomScheduleDate).map((date, dayIndex) => (
                  <div
                    key={date}
                    className={
                      date === localToday()
                        ? "bg-yellow-50 border-b border-r p-2 text-center font-semibold"
                        : "bg-gray-50 border-b border-r p-2 text-center font-semibold"
                    }
                    style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
                  >
                    {formatScheduleDate(date)}
                  </div>
                ))}

                {times.map((time, timeIndex) => (
                  <div
                    key={time}
                    className="sticky left-0 z-10 bg-gray-50 border-b border-r px-2 py-1 text-right text-xs text-gray-600"
                    style={{ gridColumn: 1, gridRow: timeIndex + 2 }}
                  >
                    {time.endsWith(":00") ? time : ""}
                  </div>
                ))}

                {getWeekDates(classroomScheduleDate).map((date, dayIndex) =>
                  times.map((time, timeIndex) => (
                    <div
                      key={`${date}-${time}`}
                      className={
                        date === localToday()
                          ? "bg-yellow-50/70 border-b border-r border-gray-200"
                          : "bg-white border-b border-r border-gray-200"
                      }
                      style={{ gridColumn: dayIndex + 2, gridRow: timeIndex + 2 }}
                    />
                  ))
                )}

                {getWeekDates(classroomScheduleDate).flatMap((date, dayIndex) =>
                  classroomBookingsForDate(date).map((booking) => {
                    const startIndex = times.findIndex((time) => time === cleanTime(booking.start_time));

                    if (startIndex < 0) return null;

                    const classroomIndex = Math.max(
                      0,
                      classrooms.findIndex((room) => room.id === booking.classroom_id)
                    );
                    const rowSpan = Math.max(
                      1,
                      Math.ceil(minutesBetween(booking.start_time, booking.end_time) / 30)
                    );
                    const label = [
                      classroomName(booking.classroom_id),
                      `${cleanTime(booking.start_time)}-${cleanTime(booking.end_time)}`,
                      bookingPerson(booking),
                      booking.remark,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={`${date}-${booking.id}`}
                        title={label}
                        className={`${scheduleBlockColor(classroomIndex)} z-20 m-1 rounded px-2 py-1 text-xs text-white shadow-sm overflow-hidden`}
                        style={{
                          gridColumn: dayIndex + 2,
                          gridRow: `${startIndex + 2} / span ${rowSpan}`,
                        }}
                      >
                        <div className="font-semibold">
                          {classroomName(booking.classroom_id)} · {cleanTime(booking.start_time)}-{cleanTime(booking.end_time)}
                        </div>
                        <div>{bookingPerson(booking)}</div>
                        {booking.remark && <div>{booking.remark}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>

        {adminView === "roles" && (
          <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
            <h2 className="text-3xl font-bold mb-4">Manage Roles</h2>
            <p className="text-gray-600">
              Role management section selected.
            </p>
          </section>
        )}

        {adminView === "suspensions" && (
          <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
            <h2 className="text-3xl font-bold mb-4">Suspensions</h2>
            <p className="text-gray-600">
              Suspension management section selected.
            </p>
          </section>
        )}

        <div className="space-y-8">
          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-4">Practice Room Bookings</h2>

            {practiceBookings.length === 0 && (
              <p className="text-gray-600">No future practice room bookings.</p>
            )}

            <div className="space-y-4">
              {practiceBookings.map((booking) => (
                <div key={booking.id} className="border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{roomName(booking.room_id)}</p>
                    <p className="text-gray-600">
                      {booking.booking_date} · {cleanTime(booking.start_time)}–{cleanTime(booking.end_time)}
                    </p>
                    <p className="text-gray-500 text-sm">{bookingPerson(booking)}</p>
                    {booking.remark && <p className="text-gray-500 text-sm">Remark: {booking.remark}</p>}
                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">Recurring</span>
                    )}
                  </div>

                  <button
                    onClick={() => cancelPractice(booking.id)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-4">Classroom Bookings</h2>

            {classroomBookings.length === 0 && (
              <p className="text-gray-600">No future classroom bookings.</p>
            )}

            <div className="space-y-4">
              {classroomBookings.map((booking) => (
                <div key={booking.id} className="border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{classroomName(booking.classroom_id)}</p>
                    <p className="text-gray-600">
                      {booking.booking_date} · {cleanTime(booking.start_time)}–{cleanTime(booking.end_time)}
                    </p>
                    <p className="text-gray-500 text-sm">{bookingPerson(booking)}</p>
                    {booking.remark && <p className="text-gray-500 text-sm">Remark: {booking.remark}</p>}
                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">Recurring</span>
                    )}
                  </div>

                  <button
                    onClick={() => cancelClassroom(booking.id)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-4">Equipment Renting</h2>

            {equipmentCheckouts.length === 0 && (
              <p className="text-gray-600">No active equipment renting.</p>
            )}

            <div className="space-y-4">
              {equipmentCheckouts.map((checkout) => (
                <div key={checkout.id} className="border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{checkout.equipment_code}</p>
                    <p className="text-gray-600">
                      {checkout.renter_name} · {checkout.uni}
                    </p>
                    <p className="text-gray-500 text-sm">{checkout.email}</p>
                    <p className="text-gray-500 text-sm">
                      Checkout: {checkout.checkout_date || "—"} · Due: {checkout.return_date || "—"}
                    </p>
                    {checkout.instructor && (
                      <p className="text-gray-500 text-sm">Instructor: {checkout.instructor}</p>
                    )}
                    {checkout.notes && (
                      <p className="text-gray-500 text-sm">Notes: {checkout.notes}</p>
                    )}
                  </div>

                  <button
                    onClick={() => returnEquipment(checkout)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Return
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
