"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PracticePage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      setUser(user);

      const { data: role } = await supabase
        .from("user_roles")
        .select("*")
        .eq("email", user.email)
        .single();

      if (role?.role === "admin") {
        setIsAdmin(true);
      }
    }

    load();
  }, []);

  function logout() {
    supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">
            Practice Room Reservation
          </h1>

          <p className="text-gray-600 mt-2">
            Rooms 515A–515L · Monday–Friday · 9AM–9PM
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          {user && (
            <>
              <span className="text-gray-700">
                Logged in as <strong>{user.email}</strong>
                {isAdmin && <span> · admin</span>}
              </span>

              <button
                onClick={() => window.location.href = "/my-bookings"}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                My Bookings
              </button>

              <button
                onClick={() => window.location.href = "/practice?view=recurring"}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Recurring Booking
              </button>

              <button
                onClick={() => window.location.href = "/equipment"}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Equipment
              </button>

              <button
                onClick={() => window.location.href = "/classrooms"}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Classrooms
              </button>

              {isAdmin && (
                <button
                  onClick={() =>
                    (window.location.href = "/admin-bookings")
                  }
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Admin
                </button>
              )}

              <button
                onClick={logout}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Log out
              </button>
            </>
          )}
        </div>

        <div className="bg-white border rounded-xl p-10 text-gray-500">
          Practice room schedule loads here.
        </div>
      </div>
    </main>
  );
}
