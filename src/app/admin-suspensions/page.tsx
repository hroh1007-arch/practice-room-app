"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Suspension = {
  email: string;
  name: string | null;
  uni: string | null;
  reason: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
};

export default function AdminSuspensionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);

  const [name, setName] = useState("");
  const [uni, setUni] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const adminEmails = [
    "hh3144@tc.columbia.edu",
    "jcg21@tc.columbia.edu",
    "instruments@tc.columbia.edu",
    "ma3412@tc.columbia.edu",
  ];

  const isAdmin = !!user?.email && adminEmails.includes(user.email.toLowerCase());

  function uniToEmail(value: string) {
    const clean = value.trim().toLowerCase();
    if (clean.includes("@")) return clean;
    return `${clean}@tc.columbia.edu`;
  }

  async function loadData() {
    const { data, error } = await supabase
      .from("user_suspensions")
      .select("*")
      .order("active", { ascending: false })
      .order("email", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setSuspensions((data || []) as Suspension[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    loadData();
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/admin-suspensions" },
    });
  }

  async function saveSuspension() {
    if (!name.trim() || !uni.trim() || !reason.trim() || !startDate || !endDate) {
      alert("Please fill out name, UNI, start date, end date, and reason.");
      return;
    }

    const email = uniToEmail(uni);

    const { error } = await supabase.from("user_suspensions").upsert({
      email,
      name: name.trim(),
      uni: uni.trim().toLowerCase(),
      reason: reason.trim(),
      start_date: startDate,
      end_date: endDate,
      active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setUni("");
    setReason("");
    setStartDate("");
    setEndDate("");

    await loadData();
    alert("Suspension saved.");
  }

  async function endSuspension(email: string) {
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
          <button onClick={login} className="bg-black text-white px-5 py-3 rounded-lg w-full">
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
          <p>Only admins can manage suspensions.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">Suspensions</h1>
        <p className="text-gray-600 mb-8">Suspend users from making new bookings.</p>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 flex-wrap">
          <button onClick={() => (window.location.href = "/admin-bookings")} className="border px-4 py-2 rounded-lg">
            Admin Bookings
          </button>
          <button onClick={() => (window.location.href = "/admin-roles")} className="border px-4 py-2 rounded-lg">
            Manage Roles
          </button>
        </div>

        <section className="bg-white rounded-2xl shadow-lg border p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Create Suspension</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="border rounded-lg px-4 py-2" />
            <input value={uni} onChange={(e) => setUni(e.target.value)} placeholder="UNI or email" className="border rounded-lg px-4 py-2" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-4 py-2" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-4 py-2" />
          </div>

          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Suspension reason" className="border rounded-lg px-4 py-2 w-full mt-4" />

          <button onClick={saveSuspension} className="bg-black text-white px-5 py-3 rounded-lg mt-4">
            Save Suspension
          </button>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border text-left">Name</th>
                <th className="p-3 border text-left">UNI</th>
                <th className="p-3 border text-left">Email</th>
                <th className="p-3 border text-left">Duration</th>
                <th className="p-3 border text-left">Reason</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {suspensions.map((s) => (
                <tr key={s.email}>
                  <td className="p-3 border">{s.name}</td>
                  <td className="p-3 border">{s.uni}</td>
                  <td className="p-3 border">{s.email}</td>
                  <td className="p-3 border">{s.start_date} to {s.end_date}</td>
                  <td className="p-3 border">{s.reason}</td>
                  <td className="p-3 border">{s.active ? "Active" : "Ended"}</td>
                  <td className="p-3 border">
                    {s.active && (
                      <button onClick={() => endSuspension(s.email)} className="bg-black text-white px-3 py-1 rounded">
                        End
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
