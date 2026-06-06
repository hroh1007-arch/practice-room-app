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
  requester_name?: string | null;
  requester_email: string | null;
  requester_uni: string | null;
  phone?: string | null;
  programme?: string | null;
  instructor?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  reason: string | null;
  status: string | null;
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

function cleanTime(time?: string | null) {
  return (time || "").slice(0, 5);
}

export default function AdminBookingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classrooms, setClassrooms] = useState<Room[]>([]);
  const [practiceBookings, setPracticeBookings] = useState<PracticeBooking[]>([]);
  const [classroomBookings, setClassroomBookings] = useState<ClassroomBooking[]>([]);
  const [equipmentCheckouts, setEquipmentCheckouts] = useState<EquipmentCheckout[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([]);
  const [view, setView] = useState<"practice" | "classrooms" | "equipment" | "requests">("practice");

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

    const { data: roomData } = await supabase.from("practice_rooms").select("id, room_number");
    setRooms(roomData || []);

    const { data: classroomData } = await supabase.from("classrooms").select("id, room_number");
    setClassrooms(classroomData || []);

    if (!activeUser?.email) return;

    const { data: practiceData } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    setPracticeBookings(practiceData || []);

    const { data: classroomBookingsData } = await supabase
      .from("classroom_bookings")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    setClassroomBookings(classroomBookingsData || []);

    const { data: checkoutData } = await supabase
      .from("equipment_checkouts")
      .select("*")
      .order("checkout_date", { ascending: false });

    setEquipmentCheckouts(checkoutData || []);

    const { data: requestData } = await supabase
      .from("equipment_requests")
      .select("*")
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

  async function cancelPractice(id: string) {
    if (!confirm("Cancel this practice room booking?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) alert(error.message);
    await loadData();
  }

  async function cancelClassroom(id: string) {
    if (!confirm("Cancel this classroom booking?")) return;
    const { error } = await supabase.from("classroom_bookings").delete().eq("id", id);
    if (error) alert(error.message);
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

    if (error) alert(error.message);
    await loadData();
  }

  async function deleteCheckout(id: string) {
    if (!confirm("Delete this checkout record?")) return;
    const { error } = await supabase.from("equipment_checkouts").delete().eq("id", id);
    if (error) alert(error.message);
    await loadData();
  }

  async function approveRequest(request: EquipmentRequest) {
    const { error: checkoutError } = await supabase.from("equipment_checkouts").insert({
      equipment_code: request.equipment_code,
      renter_name: request.requester_name || "",
      uni: request.requester_uni || "",
      email: request.requester_email || "",
      instructor: request.instructor || "",
      checkout_date: request.start_date || "",
      return_date: request.end_date || "",
      returned: false,
      notes: request.reason || "",
    });

    if (checkoutError) {
      alert(checkoutError.message);
      return;
    }

    const { error } = await supabase
      .from("equipment_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.email || "",
      })
      .eq("id", request.id);

    if (error) alert(error.message);
    await loadData();
  }

  async function declineRequest(request: EquipmentRequest) {
    const { error } = await supabase
      .from("equipment_requests")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        declined_by: user?.email || "",
      })
      .eq("id", request.id);

    if (error) alert(error.message);
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">Admin Bookings</h1>
          <p className="text-gray-600 mt-2">
            Unified admin view for practice rooms, classrooms, equipment checkouts, and equipment requests.
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          <button onClick={() => (window.location.href = "/")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Main Menu</button>
          <button onClick={() => (window.location.href = "/practice")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Practice Rooms</button>
          <button onClick={() => (window.location.href = "/classrooms")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Classrooms</button>
          <button onClick={() => (window.location.href = "/equipment")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Equipment</button>

          <button onClick={() => setView("practice")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Practice</button>
          <button onClick={() => setView("classrooms")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Classrooms Admin</button>
          <button onClick={() => setView("equipment")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Equipment Renting</button>
          <button onClick={() => setView("requests")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Equipment Requests</button>

          <span className="text-gray-700 ml-auto">
            Logged in as <strong>{user.email}</strong>
          </span>
        </div>

        {view === "practice" && (
          <Section title="Practice Room Bookings" empty={practiceBookings.length === 0}>
            {practiceBookings.map((b) => (
              <Card key={b.id}>
                <div>
                  <p className="font-semibold text-lg">{roomName(b.room_id)}</p>
                  <p className="text-gray-600">{b.booking_date} · {cleanTime(b.start_time)}–{cleanTime(b.end_time)}</p>
                  <p className="text-gray-500 text-sm">{b.user_email}</p>
                  {b.remark && <p className="text-gray-500 text-sm">Remark: {b.remark}</p>}
                  {b.recurring_series_id && <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">Recurring</span>}
                </div>
                <button onClick={() => cancelPractice(b.id)} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Cancel</button>
              </Card>
            ))}
          </Section>
        )}

        {view === "classrooms" && (
          <Section title="Classroom Bookings" empty={classroomBookings.length === 0}>
            {classroomBookings.map((b) => (
              <Card key={b.id}>
                <div>
                  <p className="font-semibold text-lg">{classroomName(b.classroom_id)}</p>
                  <p className="text-gray-600">{b.booking_date} · {cleanTime(b.start_time)}–{cleanTime(b.end_time)}</p>
                  <p className="text-gray-500 text-sm">{b.user_email}</p>
                  {b.remark && <p className="text-gray-500 text-sm">Remark: {b.remark}</p>}
                  {b.recurring_series_id && <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">Recurring</span>}
                </div>
                <button onClick={() => cancelClassroom(b.id)} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Cancel</button>
              </Card>
            ))}
          </Section>
        )}

        {view === "equipment" && (
          <Section title="Equipment Renting" empty={equipmentCheckouts.length === 0}>
            {equipmentCheckouts.map((c) => (
              <Card key={c.id}>
                <div>
                  <p className="font-semibold text-lg">{c.equipment_code}</p>
                  <p className="text-gray-600">{c.renter_name} · {c.uni}</p>
                  <p className="text-gray-500 text-sm">{c.email}</p>
                  <p className="text-gray-500 text-sm">Checkout: {c.checkout_date || "—"} · Due: {c.return_date || "—"}</p>
                  <p className="text-gray-500 text-sm">Status: {c.returned ? "Returned" : "Active"}</p>
                  {c.actual_return_date && <p className="text-gray-500 text-sm">Actual return: {c.actual_return_date}</p>}
                  {c.notes && <p className="text-gray-500 text-sm">Notes: {c.notes}</p>}
                </div>
                <div className="flex gap-2">
                  {!c.returned && <button onClick={() => returnEquipment(c)} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Return</button>}
                  <button onClick={() => deleteCheckout(c.id)} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Delete</button>
                </div>
              </Card>
            ))}
          </Section>
        )}

        {view === "requests" && (
          <Section title="Equipment Requests" empty={equipmentRequests.length === 0}>
            {equipmentRequests.map((r) => (
              <Card key={r.id}>
                <div>
                  <p className="font-semibold text-lg">{r.equipment_code} · {r.item_name}</p>
                  <p className="text-gray-600">{r.requester_name} · {r.requester_uni}</p>
                  <p className="text-gray-500 text-sm">{r.requester_email}</p>
                  <p className="text-gray-500 text-sm">{r.start_date} {r.start_time} → {r.end_date} {r.end_time}</p>
                  <p className="text-gray-500 text-sm">Status: {r.status || "pending"}</p>
                  {r.reason && <p className="text-gray-500 text-sm">Reason: {r.reason}</p>}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => approveRequest(r)} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Approve</button>
                    <button onClick={() => declineRequest(r)} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Decline</button>
                  </div>
                )}
              </Card>
            ))}
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-lg border p-6">
      <h2 className="text-3xl font-bold mb-6">{title}</h2>
      {empty ? <p className="text-gray-600">No records.</p> : <div className="space-y-4">{children}</div>}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 flex items-center justify-between gap-4">
      {children}
    </div>
  );
}
