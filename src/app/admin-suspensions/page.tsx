"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Suspension = {
  email: string;
  reason: string;
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
  const [roles, setRoles] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [email, setEmail] = useState("");
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
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("*");

    setRoles(roleData || []);

    const { data } = await supabase
      .from("user_suspensions")
      .select("*")
      .order("email");

    setSuspensions((data || []) as Suspension[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      loadData();
    });
  }, []);

  async function suspendUser() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      alert("Enter an email.");
      return;
    }

    const { error } = await supabase
      .from("user_suspensions")
      .upsert({
        email: cleanEmail,
        reason,
        active: true,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setEmail("");
    setReason("");
    await loadData();
  }

  async function unsuspend(email: string) {
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

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>

          <button
            onClick={() => (window.location.href = "/")}
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">Suspensions</h1>

        <p className="text-gray-600 mb-8">
          Suspend or restore booking access.
        </p>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 flex-wrap">
          <button
            onClick={() => (window.location.href = "/admin-bookings")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Admin
          </button>

          <button
            onClick={() => (window.location.href = "/admin-roles")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Manage Roles
          </button>
        </div>

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Suspend User</h2>

          <div className="flex gap-3 flex-wrap">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@tc.columbia.edu"
              className="border rounded-lg px-4 py-2 flex-1 min-w-[260px]"
            />

            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
              className="border rounded-lg px-4 py-2 flex-1 min-w-[260px]"
            />

            <button
              onClick={suspendUser}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Suspend
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border text-left">Email</th>
                <th className="p-3 border text-left">Reason</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {suspensions.map((s) => (
                <tr key={s.email}>
                  <td className="p-3 border">{s.email}</td>
                  <td className="p-3 border">{s.reason}</td>
                  <td className="p-3 border">
                    {s.active ? "Suspended" : "Inactive"}
                  </td>

                  <td className="p-3 border">
                    {s.active && (
                      <button
                        onClick={() => unsuspend(s.email)}
                        className="bg-black text-white px-3 py-1 rounded hover:bg-gray-700"
                      >
                        Restore
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
