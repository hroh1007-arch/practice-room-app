"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Room = {
  id: string;
  room_number: string;
  description?: string | null;
};

type Booking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  remark?: string | null;
  recurring_series_id?: string | null;
};

type UserRole = {
  id?: string;
  email: string;
  role: "admin" | "instructor";
};

type Suspension = {
  id?: string;
  email: string;
  reason?: string | null;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};

type Selection = {
  room: Room;
  start: string;
} | null;

const times = [
  "09:00", "09:30",
  "10:00", "10:30",
  "11:00", "11:30",
  "12:00", "12:30",
  "13:00", "13:30",
  "14:00", "14:30",
  "15:00", "15:30",
  "16:00", "16:30",
  "17:00", "17:30",
  "18:00", "18:30",
  "19:00", "19:30",
  "20:00", "20:30",
];

const allowedDomains = ["@tc.columbia.edu", "@columbia.edu"];

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

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function cellEnd(time: string) {
  return minutesToTime(timeToMinutes(time) + 30);
}

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(aEnd) > timeToMinutes(bStart)
  );
}

function isWeekend(date: string) {
  const day = new Date(date + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

function isPastDate(date: string) {
  return date < localToday();
}

function isPastTime(date: string, time: string) {
  const today = localToday();

  if (date < today) return true;
  if (date > today) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return timeToMinutes(time) < current;
}

function bookingEnded(booking: Booking) {
  const today = localToday();

  if (booking.booking_date < today) return true;
  if (booking.booking_date > today) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  return timeToMinutes(booking.end_time) <= current;
}

function getWeekRange(selectedDate: string) {
  const dateObj = new Date(selectedDate + "T00:00:00");
  const day = dateObj.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(dateObj);
  monday.setDate(dateObj.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function uniFromEmail(email?: string | null) {
  if (!email) return "";
  return email.split("@")[0];
}

function displayUser(email?: string | null) {
  if (!email) return "Unknown";
  return `${uniFromEmail(email)} · ${email}`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);

              {roles.length === 0 && (
                <p className="text-gray-600">No roles added yet.</p>
              )}

              <div className="space-y-4">
                {roles.map((role) => (
                  <div
                    key={role.email}
                    className="border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{displayUser(role.email)}</p>
                      <p className="text-gray-600 capitalize">{role.role}</p>
                    </div></div>

              <div className="space-y-4">
                {suspensions.map((suspension) => (
                  <div
                    key={suspension.email}
                    className="border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{displayUser(suspension.email)}</p>
                      <p className="text-gray-600">
                        Status: {suspension.active ? "Active suspension" : "Inactive"}
                      </p>
                      {suspension.reason && (
                        <p className="text-gray-500 text-sm">
                          Reason: {suspension.reason}
                        </p>
                      )}
                    </div>

                    {suspension.active && (
                      <button
                        onClick={() => unsuspendUser(suspension.email)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Unsuspend
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}