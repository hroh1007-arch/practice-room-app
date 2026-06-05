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

function today() {
  return new Date().toISOString().split("T")[0];
}

function cleanTime(time?: string | null) {
  return (time || "").slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function bookingEnded(booking: { booking_date: string; end_time: string }) {
  const nowDate = today();

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

  const [practiceBookings, setPracticeBookings] = useState<PracticeBooking[]>([]);
  const [classroomBookings, setClassroomBookings] = useState<ClassroomBooking[]>([]);
  const [equipmentCheckouts, setEquipmentCheckouts] = useState<EquipmentCheckout[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([]);

  async function loadData(currentUser?: User | null) {
    const activeUser = currentUser || user;

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

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/my-bookings",
      },
    });
  }

  async function cancelPracticeBooking(id: string) {
    if (!confirm("Cancel this practice room booking?")) return;

    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function cancelClassroomBooking(id: string) {
    if (!confirm("Cancel this classroom booking?")) return;

    const { error } = await supabase.from("classroom_bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  function roomName(id: string) {
    return rooms.find((r) => r.id === id)?.room_number || id;
  }

  function classroomName(id: string) {
    return classrooms.find((r) => r.id === id)?.room_number || id;
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

          <span className="text-gray-700 ml-auto">
            Logged in as <strong>{user.email}</strong>
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
                      {booking.booking_date} · {cleanTime(booking.start_time)}–
                      {cleanTime(booking.end_time)}
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
                      {booking.booking_date} · {cleanTime(booking.start_time)}–
                      {cleanTime(booking.end_time)}
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
            <h2 className="text-3xl font-bold mb-4">Equipment Checkouts</h2>

            {equipmentCheckouts.length === 0 && (
              <p className="text-gray-600">No active equipment checkouts.</p>
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
            <h2 className="text-3xl font-bold mb-4">Equipment Requests</h2>

            {equipmentRequests.length === 0 && (
              <p className="text-gray-600">No equipment requests.</p>
            )}

            <div className="space-y-4">
              {equipmentRequests.map((request) => (
                <div key={request.id} className="border rounded-xl p-4">
                  <p className="font-semibold text-lg">
                    {request.equipment_code} · {request.item_name}
                  </p>

                  <p className="text-gray-600">
                    {request.start_date || "—"} → {request.end_date || "—"}
                  </p>

                  <p className="text-gray-500 text-sm">
                    Status: {request.status || "pending"}
                  </p>

                  {request.reason && (
                    <p className="text-gray-500 text-sm">Reason: {request.reason}</p>
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
