"use client";

import { useEffect, useState } from "react";
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

type AdminCancelDraft =
  | { kind: "practice"; booking: PracticeBooking }
  | { kind: "classroom"; booking: ClassroomBooking };

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

function addDays(date: string, days: number) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

function getWeekRange(selectedDate: string) {
  const dateObj = new Date(selectedDate + "T00:00:00");
  const day = dateObj.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(selectedDate, diffToMonday);
  const friday = addDays(monday, 4);

  return { start: monday, end: friday };
}

function formatShortDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(week: { start: string; end: string }) {
  return `${formatShortDate(week.start)} - ${formatShortDate(week.end)}`;
}

function cleanTime(time?: string | null) {
  return (time || "").slice(0, 5);
}

function formatTime12(time: string) {
  const [hour, minute] = cleanTime(time).split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
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
  const [equipmentCheckouts, setEquipmentCheckouts] = useState<EquipmentCheckout[]>([]);
  const [authUserNames, setAuthUserNames] = useState<Record<string, string>>({});
  const [cancelDraft, setCancelDraft] = useState<AdminCancelDraft | null>(null);
  const [practiceFilterDate, setPracticeFilterDate] = useState(localToday());
  const [practiceFilterRoomId, setPracticeFilterRoomId] = useState("");
  const [classroomFilterDate, setClassroomFilterDate] = useState(localToday());
  const [classroomFilterRoomId, setClassroomFilterRoomId] = useState("");

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

    setRooms(
      (roomData || []).filter(
        (room) =>
          room.room_number !== "515I" &&
          !["435", "519", "522", "524", "526"].includes(room.room_number)
      )
    );

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

    setPracticeBookings(activePracticeBookings);
    setClassroomBookings(activeClassroomBookings);
    await loadAuthUserNames([...activePracticeBookings, ...activeClassroomBookings]);

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

  useEffect(() => {
    if (rooms.length === 0) return;
    if (!rooms.some((room) => room.id === practiceFilterRoomId)) {
      setPracticeFilterRoomId(rooms[0].id);
    }
  }, [rooms, practiceFilterRoomId]);

  useEffect(() => {
    if (classrooms.length === 0) return;
    if (!classrooms.some((room) => room.id === classroomFilterRoomId)) {
      setClassroomFilterRoomId(classrooms[0].id);
    }
  }, [classrooms, classroomFilterRoomId]);

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

  function cancelDraftLocation(draft: AdminCancelDraft) {
    return draft.kind === "practice"
      ? roomName(draft.booking.room_id)
      : classroomName(draft.booking.classroom_id);
  }

  function activePracticeRoomId() {
    return practiceFilterRoomId || rooms[0]?.id || "";
  }

  function activeClassroomId() {
    return classroomFilterRoomId || classrooms[0]?.id || "";
  }

  function jumpPracticeWeek(days: number) {
    const nextDate = addDays(practiceFilterDate, days);
    setPracticeFilterDate(nextDate < localToday() ? localToday() : nextDate);
  }

  function jumpClassroomWeek(days: number) {
    const nextDate = addDays(classroomFilterDate, days);
    setClassroomFilterDate(nextDate < localToday() ? localToday() : nextDate);
  }

  const practiceWeek = getWeekRange(practiceFilterDate);
  const classroomWeek = getWeekRange(classroomFilterDate);
  const filteredPracticeBookings = practiceBookings.filter(
    (booking) =>
      booking.room_id === activePracticeRoomId() &&
      booking.booking_date >= practiceWeek.start &&
      booking.booking_date <= practiceWeek.end
  );
  const filteredClassroomBookings = classroomBookings.filter(
    (booking) =>
      booking.classroom_id === activeClassroomId() &&
      booking.booking_date >= classroomWeek.start &&
      booking.booking_date <= classroomWeek.end
  );

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

  function cancelPractice(id: string) {
    const booking = practiceBookings.find((row) => row.id === id);
    if (booking) setCancelDraft({ kind: "practice", booking });
  }

  function cancelClassroom(id: string) {
    const booking = classroomBookings.find((row) => row.id === id);
    if (booking) setCancelDraft({ kind: "classroom", booking });
  }

  async function confirmSingleCancel() {
    if (!cancelDraft) return;

    const table = cancelDraft.kind === "practice" ? "bookings" : "classroom_bookings";
    const { error } = await supabase.from(table).delete().eq("id", cancelDraft.booking.id);

    if (error) {
      alert(error.message);
      return;
    }

    setCancelDraft(null);
    await loadData();
  }

  async function confirmSeriesCancel() {
    if (!cancelDraft?.booking.recurring_series_id) return;

    const table = cancelDraft.kind === "practice" ? "bookings" : "classroom_bookings";
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("recurring_series_id", cancelDraft.booking.recurring_series_id);

    if (error) {
      alert(error.message);
      return;
    }

    setCancelDraft(null);
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
                aria-label="Suspension start date"
                type="date"
                value={suspensionStart}
                onChange={(e) => setSuspensionStart(e.target.value)}
                className="w-full border rounded-lg px-4 py-2"
              />

              <input
                aria-label="Suspension end date"
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
      {cancelDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-2xl font-bold">
              {cancelDraft.booking.recurring_series_id ? "Cancel Recurring Booking" : "Cancel Booking"}
            </h2>
            <p className="text-gray-600 mt-2">
              {cancelDraftLocation(cancelDraft)} · {cancelDraft.booking.booking_date} ·{" "}
              {formatTime12(cancelDraft.booking.start_time)}-{formatTime12(cancelDraft.booking.end_time)}
            </p>
            <p className="text-gray-500 text-sm mt-1">{bookingPerson(cancelDraft.booking)}</p>
            {cancelDraft.booking.recurring_series_id && (
              <p className="text-sm text-gray-500 mt-2">
                Choose whether to cancel only this booking or all bookings in the recurring series.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                onClick={() => setCancelDraft(null)}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Keep Booking
              </button>
              <button
                onClick={confirmSingleCancel}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Cancel This Booking
              </button>
              {cancelDraft.booking.recurring_series_id && (
                <button
                  onClick={confirmSeriesCancel}
                  className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                >
                  Cancel All Recurring Bookings
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

            <button
              onClick={() => (window.location.href = "/admin-practice-schedule")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Practice Schedule
            </button>

            <button
              onClick={() => (window.location.href = "/admin-classroom-schedule")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Classroom Schedule
            </button>


          <span className="text-gray-700 ml-auto">
            Hello <strong>{displayNameFromUser(user)}</strong> · Logged in as <strong>{user.email}</strong>
          </span>
        </div>

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
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-3xl font-bold mr-auto">Practice Room Bookings</h2>

              <div className="flex items-center overflow-hidden rounded-lg border bg-white">
                <button
                  type="button"
                  onClick={() => jumpPracticeWeek(-7)}
                  aria-label="Previous week"
                  className="h-10 w-10 border-r text-xl leading-none text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  ‹
                </button>
                <span className="min-w-32 px-4 text-center text-sm font-semibold text-gray-700">
                  {formatWeekLabel(practiceWeek)}
                </span>
                <button
                  type="button"
                  onClick={() => jumpPracticeWeek(7)}
                  aria-label="Next week"
                  className="h-10 w-10 border-l text-xl leading-none text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  ›
                </button>
              </div>
              <select
                value={activePracticeRoomId()}
                onChange={(event) => setPracticeFilterRoomId(event.target.value)}
                aria-label="Practice room"
                className="border rounded-lg px-4 py-2 min-w-36 bg-white"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
              </select>
            </div>

            {filteredPracticeBookings.length === 0 && (
              <p className="text-gray-600">No practice room bookings for this room and week.</p>
            )}

            <div className="space-y-4">
              {filteredPracticeBookings.map((booking) => (
                <div key={booking.id} className="border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{roomName(booking.room_id)}</p>
                    <p className="text-gray-600">
                      {booking.booking_date} · {formatTime12(booking.start_time)}–{formatTime12(booking.end_time)}
                    </p>
                    <p className="text-gray-500 text-sm">{bookingPerson(booking)}</p>
                    {booking.remark && <p className="text-gray-500 text-sm">Remark: {booking.remark}</p>}
                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">Recurring</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => cancelPractice(booking.id)}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-3xl font-bold mr-auto">Classroom Bookings</h2>

              <div className="flex items-center overflow-hidden rounded-lg border bg-white">
                <button
                  type="button"
                  onClick={() => jumpClassroomWeek(-7)}
                  aria-label="Previous week"
                  className="h-10 w-10 border-r text-xl leading-none text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  ‹
                </button>
                <span className="min-w-32 px-4 text-center text-sm font-semibold text-gray-700">
                  {formatWeekLabel(classroomWeek)}
                </span>
                <button
                  type="button"
                  onClick={() => jumpClassroomWeek(7)}
                  aria-label="Next week"
                  className="h-10 w-10 border-l text-xl leading-none text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  ›
                </button>
              </div>
              <select
                value={activeClassroomId()}
                onChange={(event) => setClassroomFilterRoomId(event.target.value)}
                aria-label="Classroom"
                className="border rounded-lg px-4 py-2 min-w-36 bg-white"
              >
                {classrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
              </select>
            </div>

            {filteredClassroomBookings.length === 0 && (
              <p className="text-gray-600">No classroom bookings for this classroom and week.</p>
            )}

            <div className="space-y-4">
              {filteredClassroomBookings.map((booking) => (
                <div key={booking.id} className="border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{classroomName(booking.classroom_id)}</p>
                    <p className="text-gray-600">
                      {booking.booking_date} · {formatTime12(booking.start_time)}–{formatTime12(booking.end_time)}
                    </p>
                    <p className="text-gray-500 text-sm">{bookingPerson(booking)}</p>
                    {booking.remark && <p className="text-gray-500 text-sm">Remark: {booking.remark}</p>}
                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">Recurring</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => cancelClassroom(booking.id)}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
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
