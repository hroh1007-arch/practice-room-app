"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type RoleRow = {
  email: string;
  role: "admin" | "instructor";
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

export default function AdminRolesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "instructor">("instructor");

  const isAdmin =
    !!user?.email &&
    (backupAdminEmails.includes(user.email.toLowerCase()) ||
      roles.some(
        (r) =>
          r.email.toLowerCase() === user.email?.toLowerCase() &&
          r.role === "admin"
      ));

  async function loadData() {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("email", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRoles((data || []) as RoleRow[]);
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
        redirectTo: window.location.origin + "/admin-roles",
      },
    });
  }

  async function saveRole() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      alert("Enter an email.");
      return;
    }

    const { error } = await supabase.from("user_roles").upsert({
      email: cleanEmail,
      role,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setEmail("");
    setRole("instructor");
    await loadData();
  }

  async function changeRole(row: RoleRow, newRole: "admin" | "instructor") {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("email", row.email);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function removeRole(row: RoleRow) {
    if (!confirm(`Remove role for ${row.email}?`)) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("email", row.email);

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
          <h1 className="text-4xl font-bold mb-4">Manage Roles</h1>
          <p className="text-gray-600 mb-6">Admin login required.</p>

          <button
            onClick={login}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Continue with TC/CU Google
          </button>

          <button
            onClick={() => (window.location.href = "/admin-bookings")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full mt-3"
          >
            Back to Admin
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
          <p className="text-gray-600 mb-6">Only admins can manage roles.</p>

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
          <h1 className="text-5xl font-bold text-gray-900">Manage Roles</h1>
          <p className="text-gray-600 mt-2">
            Add, change, or remove instructor/admin access.
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

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Add / Update Role</h2>

          <div className="flex gap-3 flex-wrap">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@tc.columbia.edu"
              className="border rounded-lg px-4 py-2 flex-1 min-w-[260px]"
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "instructor")}
              className="border rounded-lg px-4 py-2"
            >
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>

            <button
              onClick={saveRole}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Save Role
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border text-left">Email</th>
                <th className="p-3 border text-left">Role</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {roles.map((row) => (
                <tr key={row.email}>
                  <td className="p-3 border">{row.email}</td>

                  <td className="p-3 border">
                    <select
                      value={row.role}
                      onChange={(e) =>
                        changeRole(row, e.target.value as "admin" | "instructor")
                      }
                      className="border rounded-lg px-3 py-2"
                    >
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td className="p-3 border">
                    <button
                      onClick={() => removeRole(row)}
                      className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {roles.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={3}>
                    No roles found.
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
