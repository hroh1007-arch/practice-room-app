"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Role = {
  email: string;
  role: "admin" | "instructor";
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    supabase.from("user_roles").select("*").then(({ data }) => {
      setRoles(data || []);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isAdmin =
    currentRole === "admin" ||
    (user?.email ? backupAdminEmails.includes(user.email.toLowerCase()) : false);

  const isInstructor = currentRole === "instructor";
  const canSeeClassrooms = isAdmin || isInstructor;

  function goTo(path: string) {
    if (!user) {
      alert("Please log in with your TC/CU Google account first.");
      return;
    }

    window.location.href = path;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
      {user && isAdmin && (
        <button
          onClick={() => (window.location.href = "/admin-bookings")}
          className="fixed right-8 top-8 z-50 border bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100"
        >
          Admin
        </button>
      )}

      <div className="max-w-6xl w-full">
        <div className="bg-white border rounded-3xl shadow-lg p-10">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Welcome to the Teachers College Music and Music Education Booking System
            </h1>

            <p className="text-gray-600 text-lg">
              Please log in to access practice rooms, classrooms, and equipment.
            </p>
          </div>

          <div className="flex justify-center mb-10">
            {user ? (
              <div className="flex gap-4 items-center flex-wrap justify-center">
                <span className="text-gray-700">
                  Logged in as <strong>{user.email}</strong>
                </span>

                <button
                  onClick={logout}
                  className="border px-5 py-2 rounded-lg hover:bg-gray-100"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
              >
                Continue with TC/CU Google
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <button
              onClick={() => goTo("/practice")}
              className="border rounded-2xl p-8 text-left hover:bg-gray-50 hover:shadow-md transition"
            >
              <h2 className="text-2xl font-bold mb-3">Practice Rooms</h2>
              <p className="text-gray-600">
                Book and manage practice room reservations.
              </p>
            </button>

            {canSeeClassrooms && (
              <button
                onClick={() => goTo("/classrooms")}
                className="border rounded-2xl p-8 text-left hover:bg-gray-50 hover:shadow-md transition"
              >
                <h2 className="text-2xl font-bold mb-3">Classrooms</h2>
                <p className="text-gray-600">
                  Reserve classrooms for teaching, rehearsals, and events.
                </p>
              </button>
            )}

            <button
              onClick={() => goTo("/equipment")}
              className="border rounded-2xl p-8 text-left hover:bg-gray-50 hover:shadow-md transition"
            >
              <h2 className="text-2xl font-bold mb-3">Equipment</h2>
              <p className="text-gray-600">
                View inventory and request equipment checkout.
              </p>
            </button>
          </div>

          <div className="mt-12 text-center text-xs text-gray-500">
            <p>
              If you have any questions, contact instruments@tc.columbia.edu
            </p>

            <p className="mt-1">Designed by Haoran Hou</p>
          </div>
        </div>
      </div>
    </main>
  );
}
