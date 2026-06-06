"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type RoleRow = {
  email: string;
  role: "admin" | "instructor";
};

type Suspension = {
  email: string;
  reason: string | null;
  active: boolean;
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

export default function AdminSuspensionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);

  const [name, setName] = useState("");
  const [uni, setUni] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const isAdmin =
    !!user?.email &&
    (backupAdminEmails.includes(user.email.toLowerCase()) ||
      roles.some(
        (r) =>
          r.email.toLowerCase() === user.email?.toLowerCase() &&
          r.role === "admin"
      ));

  async function loadData() {
    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles((roleData || []) as RoleRow[]);

    const { data: suspensionData } = await supabase
      .from("user_suspensions")
      .select("*")
      .order("email", { ascending: true });

    setSuspensions((suspensionData || []) as Suspension[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      loadData();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      loadData();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/admin-suspensions",
      },
    });
  }

  function uniToEmail(value: string) {
    const clean = value.trim().toLowerCase();

    if (clean.includes("@")) return clean;

    return `${clean}@tc.columbia.edu`;
  }

  async function createSuspension() {
    if (!name.trim() || !uni.trim() || !startDate || !endDate || !reason.trim()) {
      alert("Please fill out name, UNI, start date, end date, and reason.");
      return;
    }

    const email = uniToEmail(uni);

    const fullReason = `Name: ${name.trim()} | UNI: ${uni.trim()} | Duration: ${startDate} to ${endDate} | Reason: ${reason.trim()}`;

    const { error } = await supabase.from("user_suspensions").upsert({
      email,
      reason: fullReason,
      active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setUni("");
    setStartDate("");
    setEndDate("");
    setReason("");

    await loadData();

    alert("Suspension saved.");
  }

  async function endSuspension(email: string) {
    if (!confirm(`End suspension for ${email}?`)) return;

    const { error } = await supabase
      .from("user_suspensions")
      .update({ active: false })
      .eq("email", email);

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
          <h1 className="text-4xl font-bold mb-4">Suspensions</h1>
          <p className="text-gray-600 mb-6">Admin login required.</p>

          <button
            onClick={login}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Continue with TC/CU Google
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
          <p className="text-gray-600 mb-6">Only admins can manage suspensions.</p>

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
          <h1 className="text-5xl font-bold text-gray-900">Suspensions</h1>
          <p className="text-gray-600 mt-2">
            Suspend users from making new bookings and end suspensions early.
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          <button
            onClick={() => (window.location.href = "/admin-bookings")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Admin Bookings
          </button>

          <button
            onClick={() => (window.location.href = "/admin-roles")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Manage Roles
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
        </div>

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Suspend User</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="border rounded-lg px-4 py-2"
            />

            <input
              value={uni}
              onChange={(e) => setUni(e.target.value)}
              placeholder="UNI or email"
              className="border rounded-lg px-4 py-2"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded-lg px-4 py-2"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded-lg px-4 py-2"
            />
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Suspension reason"
            className="border rounded-lg px-4 py-2 w-full mt-4"
          />

          <button
            onClick={createSuspension}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 mt-4"
          >
            Save Suspension
          </button>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border text-left">Email</th>
                <th className="p-3 border text-left">Details</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {suspensions.map((s) => (
                <tr key={s.email}>
                  <td className="p-3 border">{s.email}</td>
                  <td className="p-3 border">{s.reason}</td>
                  <td className="p-3 border">
                    {s.active ? "Active" : "Ended"}
                  </td>
                  <td className="p-3 border">
                    {s.active && (
                      <button
                        onClick={() => endSuspension(s.email)}
                        className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700"
                      >
                        End Suspension
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {suspensions.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={4}>
                    No suspensions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
