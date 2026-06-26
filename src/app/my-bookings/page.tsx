"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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

type EquipmentRequest = {
  id: string;
  equipment_code: string | null;
  item_name: string | null;
  requester_email: string | null;
  requester_uni: string | null;
  requester_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: string | null;
  reason: string | null;
};

type Room = {
  id: string;
  room_number: string;
};

type Role = {
  email: string;
  role: "admin" | "instructor";
};

type CancelDraft =
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

export default function MyBookingsPage() {
  const [user, setUser] = useState<User | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [classrooms, setClassrooms] = useState<Room[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [practiceBookings, setPracticeBookings] = useState<PracticeBooking[]>([]);
  const [classroomBookings, setClassroomBookings] = useState<ClassroomBooking[]>([]);
  const [equipmentCheckouts, setEquipmentCheckouts] = useState<EquipmentCheckout[]>([]);
  const [returnedEquipmentCheckouts, setReturnedEquipmentCheckouts] = useState<EquipmentCheckout[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([]);
  const [cancelDraft, setCancelDraft] = useState<CancelDraft | null>(null);

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
      .select("id, room_number");

    setClassrooms(classroomData || []);

    if (!activeUser?.email) return;

    const { data: practiceData } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", activeUser.email)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    setPracticeBookings((practiceData || []).filter((b) => !bookingEnded(b)));

    const { data: classroomData2 } = await supabase
      .from("classroom_bookings")
      .select("*")
      .eq("user_email", activeUser.email)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    setClassroomBookings((classroomData2 || []).filter((b) => !bookingEnded(b)));

    const uni = activeUser.email.split("@")[0];

    const { data: checkoutData } = await supabase
      .from("equipment_checkouts")
      .select("*")
      .or(`email.eq.${activeUser.email},uni.eq.${uni}`)
      .order("checkout_date", { ascending: false });

    setEquipmentCheckouts((checkoutData || []).filter((c) => !c.returned));
    setReturnedEquipmentCheckouts((checkoutData || []).filter((c) => c.returned));

    const { data: requestData } = await supabase
      .from("equipment_requests")
      .select("*")
      .or(`requester_email.eq.${activeUser.email},requester_uni.eq.${uni}`)
      .order("created_at", { ascending: false });

    setEquipmentRequests(requestData || []);
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

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isAdmin =
    currentRole === "admin" ||
    (user?.email ? backupAdminEmails.includes(user.email.toLowerCase()) : false);

  const isInstructor = currentRole === "instructor";
  const canSeeClassrooms = isAdmin;

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/my-bookings",
      },
    });
  }

  function cancelPracticeBooking(id: string) {
    const booking = practiceBookings.find((row) => row.id === id);
    if (booking) setCancelDraft({ kind: "practice", booking });
  }

  function cancelClassroomBooking(id: string) {
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

  function roomName(id: string) {
    return rooms.find((r) => r.id === id)?.room_number || id;
  }

  function classroomName(id: string) {
    return classrooms.find((r) => r.id === id)?.room_number || id;
  }

  function cancelDraftLocation(draft: CancelDraft) {
    return draft.kind === "practice"
      ? roomName(draft.booking.room_id)
      : classroomName(draft.booking.classroom_id);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">My Bookings</h1>
          <p className="text-gray-600 mb-6">
            Log in to view all practice room, classroom, and equipment bookings.
          </p>

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

      {isAdmin && (
        <button
          onClick={() => (window.location.href = "/admin-bookings")}
          className="fixed right-8 top-8 z-50 border bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100"
        >
          Admin
        </button>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600 mt-2">
            Practice rooms, classrooms, equipment checkouts, and equipment requests.
          </p>
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

          {canSeeClassrooms && (
            <button
              onClick={() => (window.location.href = "/classrooms")}
              className="border px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Classrooms
            </button>
          )}

          <button
            onClick={() => (window.location.href = "/equipment")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Equipment
          </button>

          <span className="text-gray-700 ml-auto">
            Hello <strong>{displayNameFromUser(user)}</strong> · Logged in as <strong>{user.email}</strong>
          </span>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-4">Practice Room Bookings</h2>

            {practiceBookings.length === 0 && (
              <p className="text-gray-600">No active practice room bookings.</p>
            )}

            <div className="space-y-4">
              {practiceBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-lg">
                      {roomName(booking.room_id)}
                    </p>

                    <p className="text-gray-600">
                      {booking.booking_date} · {formatTime12(booking.start_time)}–
                      {formatTime12(booking.end_time)}
                    </p>

                    {booking.remark && (
                      <p className="text-gray-500 text-sm">Remark: {booking.remark}</p>
                    )}

                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">
                        Recurring
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => cancelPracticeBooking(booking.id)}
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
              <p className="text-gray-600">No active classroom bookings.</p>
            )}

            <div className="space-y-4">
              {classroomBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-lg">
                      {classroomName(booking.classroom_id)}
                    </p>

                    <p className="text-gray-600">
                      {booking.booking_date} · {formatTime12(booking.start_time)}–
                      {formatTime12(booking.end_time)}
                    </p>

                    {booking.remark && (
                      <p className="text-gray-500 text-sm">Remark: {booking.remark}</p>
                    )}

                    {booking.recurring_series_id && (
                      <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">
                        Recurring
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => cancelClassroomBooking(booking.id)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-4">My Renting</h2>

            {equipmentCheckouts.length === 0 && (
              <p className="text-gray-600">No active equipment renting.</p>
            )}

            <div className="space-y-4">
              {equipmentCheckouts.map((checkout) => (
                <div key={checkout.id} className="border rounded-xl p-4">
                  <p className="font-semibold text-lg">
                    {checkout.equipment_code}
                  </p>

                  <p className="text-gray-600">
                    Checkout: {checkout.checkout_date || "—"} · Due:{" "}
                    {checkout.return_date || "—"}
                  </p>

                  {checkout.notes && (
                    <p className="text-gray-500 text-sm">Notes: {checkout.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-3xl font-bold mb-4">Equipment History</h2>

            {returnedEquipmentCheckouts.length === 0 && (
              <p className="text-gray-600">No returned equipment history.</p>
            )}

            <div className="space-y-4">
              {returnedEquipmentCheckouts.map((checkout) => (
                <div key={checkout.id} className="border rounded-xl p-4">
                  <p className="font-semibold text-lg">
                    {checkout.equipment_code}
                  </p>

                  <p className="text-gray-600">
                    Checkout: {checkout.checkout_date || "—"} · Due:{" "}
                    {checkout.return_date || "—"} · Returned:{" "}
                    {checkout.actual_return_date || "—"}
                  </p>

                  {checkout.notes && (
                    <p className="text-gray-500 text-sm">Notes: {checkout.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
