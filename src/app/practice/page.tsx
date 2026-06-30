"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import KeyboardDatePicker from "@/components/KeyboardDatePicker";

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
  user_name?: string | null;
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
  start_date?: string | null;
  end_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

type InstructorHourLimit = {
  weekly_hour_limit: number;
};

type Selection = {
  room: Room;
  start: string;
} | null;

type BookingDraft = {
  room: Room;
  start: string;
  end: string;
  bookeeEmail: string;
  bookeeName: string;
  remark: string;
} | null;

const times = [
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

const blockedDayPrefix = "blocked-day-";

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function cleanTime(time: string) {
  return time.slice(0, 5);
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

function suspensionStart(row: Suspension) {
  return row.start_date || row.starts_at?.slice(0, 10) || localToday();
}

function suspensionEnd(row: Suspension) {
  return row.end_date || row.ends_at?.slice(0, 10) || "9999-12-31";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [instructorHourLimit, setInstructorHourLimit] = useState<number | null>(null);

  const [newRoleEmail, setNewRoleEmail] = useState("");
  const [newRoleType, setNewRoleType] = useState<"admin" | "instructor">("instructor");

  const [suspendEmail, setSuspendEmail] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const [date, setDate] = useState(localToday());
  const [view, setView] = useState<
    "booking" | "myBookings" | "admin" | "roles" | "suspensions"
  >("booking");

  const [selection, setSelection] = useState<Selection>(null);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(null);
  const [cancelDraft, setCancelDraft] = useState<Booking | null>(null);

  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringRoom, setRecurringRoom] = useState("");
  const [recurringStartDate, setRecurringStartDate] = useState(localToday());
  const [recurringEndDate, setRecurringEndDate] = useState(localToday());
  const [recurringWeekday, setRecurringWeekday] = useState("1");
  const [recurringStartTime, setRecurringStartTime] = useState("10:00");
  const [recurringEndTime, setRecurringEndTime] = useState("10:30");
  const [recurringRemark, setRecurringRemark] = useState("");
  const [recurringBookeeEmail, setRecurringBookeeEmail] = useState("");
  const [recurringBookeeName, setRecurringBookeeName] = useState("");

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isBackupAdmin = user?.email
    ? backupAdminEmails.includes(user.email.toLowerCase())
    : false;

  const isAdmin = currentRole === "admin" || isBackupAdmin;
  const isInstructor = currentRole === "instructor";
  const hasUnlimitedBooking = isAdmin || isInstructor;

  async function loadData() {
    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: suspensionData } = await supabase
      .from("user_suspensions")
      .select("*")
      .order("email", { ascending: true });

    setSuspensions(suspensionData || []);

    if (user?.email) {
      const { data: limitData } = await supabase
        .from("instructor_hour_limits")
        .select("weekly_hour_limit")
        .eq("instructor_email", user.email.toLowerCase())
        .maybeSingle<InstructorHourLimit>();

      setInstructorHourLimit(limitData?.weekly_hour_limit ?? null);
    } else {
      setInstructorHourLimit(null);
    }

    const { data: roomData } = await supabase
      .from("practice_rooms")
      .select("*")
      .order("room_number");

    setRooms(
      (roomData || []).filter(
        (room) =>
          room.room_number !== "515I" &&
          !["435", "519", "522", "524", "526"].includes(room.room_number)
      )
    );

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", date);

    setBookings((bookingData || []).filter((b) => !bookingEnded(b)));

    if (user?.email) {
      const { data: mine } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_email", user.email)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      setMyBookings((mine || []).filter((b) => !bookingEnded(b)));
    }

    if (isAdmin || isInstructor) {
      const { data: all } = await supabase
        .from("bookings")
        .select("*")
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      setAdminBookings((all || []).filter((b) => !bookingEnded(b)));
    }
  }

  async function checkUser(currentUser: User | null) {
    if (!currentUser) {
      setUser(null);
      return;
    }

    const email = currentUser.email?.toLowerCase() || "";
    const allowedDomain = allowedDomains.some((domain) => email.endsWith(domain));

    if (!allowedDomain) {
      const { data: authorizedUser } = await supabase
        .from("authorized_users")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (!authorizedUser) {
        await supabase.auth.signOut();
        alert("Only TC, Columbia, or authorized users are allowed.");
        setUser(null);
        return;
      }
    }

    setUser(currentUser);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      checkUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadData();
  }, [date, user?.email, isAdmin, isInstructor]);

  async function loginWithGoogle() {
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
    setMyBookings([]);
    setAdminBookings([]);
    setSelection(null);
    setHoverTime(null);
    setView("booking");
  }

  function roomName(roomId: string) {
    return rooms.find((room) => room.id === roomId)?.room_number || "Room";
  }

  function bookingForCell(roomId: string, time: string) {
    const end = cellEnd(time);

    return bookings.find(
      (b) =>
        b.room_id === roomId &&
        overlaps(b.start_time, b.end_time, time, end) &&
        !bookingEnded(b)
    );
  }

  function isBooked(roomId: string, time: string) {
    return Boolean(bookingForCell(roomId, time));
  }

  function hasConflict(roomId: string, start: string, end: string) {
    return bookings.some(
      (b) =>
        b.room_id === roomId &&
        overlaps(b.start_time, b.end_time, start, end) &&
        !bookingEnded(b)
    );
  }

  function isPreview(roomId: string, time: string) {
    if (!selection || !hoverTime) return false;
    if (selection.room.id !== roomId) return false;

    const end = cellEnd(hoverTime);

    if (!hasUnlimitedBooking && minutesBetween(selection.start, end) > 120) {
      return false;
    }

    return (
      timeToMinutes(time) >= timeToMinutes(selection.start) &&
      timeToMinutes(time) < timeToMinutes(end)
    );
  }

  function blockedDayForDate(targetDate: string) {
    return suspensions.find(
      (row) =>
        row.active &&
        row.email.startsWith(blockedDayPrefix) &&
        targetDate >= suspensionStart(row) &&
        targetDate <= suspensionEnd(row)
    );
  }

  function focusBookingCell(roomIndex: number, timeIndex: number) {
    const next = document.getElementById(`practice-cell-${roomIndex}-${timeIndex}`);
    next?.focus();
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    room: Room,
    time: string,
    roomIndex: number,
    timeIndex: number
  ) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBookingCell(roomIndex, Math.min(times.length - 1, timeIndex + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBookingCell(roomIndex, Math.max(0, timeIndex - 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusBookingCell(Math.min(rooms.length - 1, roomIndex + 1), timeIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusBookingCell(Math.max(0, roomIndex - 1), timeIndex);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusBookingCell(roomIndex, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusBookingCell(roomIndex, times.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCellClick(room, time);
    }
  }

  async function checkSuspension() {
    if (!user?.email || hasUnlimitedBooking) return false;

    const { data } = await supabase
      .from("user_suspensions")
      .select("*")
      .eq("email", user.email)
      .eq("active", true)
      .maybeSingle();

    if (data) {
      const today = localToday();
      const start = data.start_date || data.starts_at?.slice(0, 10) || today;
      const end = data.end_date || data.ends_at?.slice(0, 10) || "9999-12-31";

      if (today < start || today > end) return false;

      alert("Your booking access is suspended.");
      return true;
    }

    return false;
  }

  async function checkDailyLimit(durationMinutes: number) {
    if (!user?.email) return false;

    const { data: dailyBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .eq("booking_date", date);

    const usedMinutes =
      dailyBookings?.reduce((total, booking) => {
        if (bookingEnded(booking)) return total;
        return total + minutesBetween(booking.start_time, booking.end_time);
      }, 0) || 0;

    if (usedMinutes + durationMinutes > 120) {
      alert("You can only book up to 2 hours per day.");
      return false;
    }

    return true;
  }

  async function checkInstructorWeeklyLimit(durationMinutes: number) {
    if (!user?.email || !isInstructor || isAdmin || instructorHourLimit === null) {
      return true;
    }

    const { start, end } = getWeekRange(date);

    const { data: weeklyBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .gte("booking_date", start)
      .lte("booking_date", end);

    const usedMinutes =
      weeklyBookings?.reduce((total, booking) => {
        if (bookingEnded(booking)) return total;
        return total + minutesBetween(booking.start_time, booking.end_time);
      }, 0) || 0;

    const allowedMinutes = instructorHourLimit * 60;

    if (usedMinutes + durationMinutes > allowedMinutes) {
      const remaining = Math.max(0, allowedMinutes - usedMinutes) / 60;
      alert(`This booking exceeds your instructor weekly limit. You have ${remaining} hour(s) remaining this week.`);
      return false;
    }

    return true;
  }

  async function checkWeeklyLimit(durationMinutes: number) {
    if (!user?.email) return false;

    const { start, end } = getWeekRange(date);

    const { data: weeklyBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_email", user.email)
      .gte("booking_date", start)
      .lte("booking_date", end);

    const usedMinutes =
      weeklyBookings?.reduce((total, booking) => {
        if (bookingEnded(booking)) return total;
        return total + minutesBetween(booking.start_time, booking.end_time);
      }, 0) || 0;

    if (usedMinutes + durationMinutes > 300) {
      alert("You can only book up to 5 hours per week.");
      return false;
    }

    return true;
  }

  async function handleCellClick(room: Room, time: string) {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    const suspended = await checkSuspension();
    if (suspended) return;

    if (isPastDate(date)) {
      alert("Cannot book past dates.");
      return;
    }

    if (isWeekend(date)) {
      alert("Weekend bookings are not allowed.");
      return;
    }

    const blockedDay = blockedDayForDate(date);
    if (blockedDay) {
      alert(`Bookings are blocked on this date: ${blockedDay.reason || "blocked day"}`);
      return;
    }

    if (isPastTime(date, time)) {
      alert("Cannot book past times.");
      return;
    }

    if (room.room_number === "515F" && !hasUnlimitedBooking) {
      alert("515F is only available to instructors/admins.");
      return;
    }

    if (isBooked(room.id, time)) return;

    if (!selection || selection.room.id !== room.id) {
      setSelection({ room, start: time });
      setHoverTime(time);
      return;
    }

    if (timeToMinutes(time) < timeToMinutes(selection.start)) {
      setSelection({ room, start: time });
      setHoverTime(time);
      return;
    }

    const start = selection.start;
    const end = cellEnd(time);
    const duration = minutesBetween(start, end);

    if (duration < 30) {
      alert("Minimum booking time is 30 minutes.");
      setSelection(null);
      setHoverTime(null);
      return;
    }

    if (!hasUnlimitedBooking && duration > 120) {
      alert("Students can only book up to 2 hours at once.");
      setSelection(null);
      setHoverTime(null);
      return;
    }

    if (hasConflict(room.id, start, end)) {
      alert("This room is already booked.");
      setSelection(null);
      setHoverTime(null);
      await loadData();
      return;
    }

    if (!hasUnlimitedBooking) {
      const dailyOk = await checkDailyLimit(duration);
      if (!dailyOk) {
        setSelection(null);
        setHoverTime(null);
        return;
      }

      const weeklyOk = await checkWeeklyLimit(duration);
      if (!weeklyOk) {
        setSelection(null);
        setHoverTime(null);
        return;
      }
    }

    if (isInstructor && !isAdmin) {
      const instructorWeeklyOk = await checkInstructorWeeklyLimit(duration);
      if (!instructorWeeklyOk) {
        setSelection(null);
        setHoverTime(null);
        return;
      }
    }

    setBookingDraft({
      room,
      start,
      end,
      bookeeEmail: user.email || "",
      bookeeName: displayNameFromUser(user),
      remark: "",
    });
  }

  async function confirmBookingDraft() {
    if (!user || !bookingDraft) return;

    const bookeeEmail = (isAdmin ? bookingDraft.bookeeEmail : user.email || "")
      .trim()
      .toLowerCase();
    const bookeeName =
      isAdmin && bookeeEmail !== user.email?.toLowerCase()
        ? bookingDraft.bookeeName.trim()
        : displayNameFromUser(user);

    if (!bookeeEmail) {
      alert("Bookee email is required.");
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      room_id: bookingDraft.room.id,
      booking_date: date,
      start_time: bookingDraft.start,
      end_time: bookingDraft.end,
      user_email: bookeeEmail,
      user_name: bookeeName || null,
      user_id: user.id,
      remark: bookingDraft.remark,
      checked_in: hasUnlimitedBooking,
      checked_in_at: hasUnlimitedBooking ? new Date().toISOString() : null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await fetch("/api/send-booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "confirm",
        email: bookeeEmail,
        room: bookingDraft.room.room_number,
        date,
        startTime: bookingDraft.start,
        endTime: bookingDraft.end,
      }),
    });

    setBookingDraft(null);
    setSelection(null);
    setHoverTime(null);
    await loadData();

    alert("Booked.");
  }

  async function cancelBooking(id: string) {
    const bookingToCancel = myBookings.find((booking) => booking.id === id) || adminBookings.find((booking) => booking.id === id);

    if (!bookingToCancel) return;
    setCancelDraft(bookingToCancel);
  }

  async function confirmCancelBooking(bookingToCancel: Booking) {
    const { error } = await supabase.from("bookings").delete().eq("id", bookingToCancel.id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetch("/api/send-booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "cancel",
        email: bookingToCancel.user_email,
        room: roomName(bookingToCancel.room_id),
        date: bookingToCancel.booking_date,
        startTime: cleanTime(bookingToCancel.start_time),
        endTime: cleanTime(bookingToCancel.end_time),
      }),
    });

    setCancelDraft(null);
    await loadData();
  }

  async function cancelSeries(seriesId: string) {
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurring_series_id", seriesId);

    if (error) {
      alert(error.message);
      return;
    }

    setCancelDraft(null);
    await loadData();
  }

  async function updateRoomDescription(room: Room) {
    if (!isAdmin) return;

    const description = window.prompt(
      `Description for ${room.room_number}:`,
      room.description || ""
    );

    if (description === null) return;

    const { error } = await supabase
      .from("practice_rooms")
      .update({ description })
      .eq("id", room.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Description updated.");
  }

  async function addRole() {
    if (!isAdmin) return;

    const normalizedEmail = newRoleEmail.trim().toLowerCase();

    if (
      !normalizedEmail.endsWith("@tc.columbia.edu") &&
      !normalizedEmail.endsWith("@columbia.edu")
    ) {
      alert("Only TC or Columbia emails can be added.");
      return;
    }

    const { error } = await supabase.from("user_roles").upsert(
      {
        email: normalizedEmail,
        role: newRoleType,
      },
      {
        onConflict: "email",
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setNewRoleEmail("");
    await loadData();
    alert("User role added or updated.");
  }

  async function removeRole(email: string) {
    if (!isAdmin) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (backupAdminEmails.includes(normalizedEmail)) {
      alert("Original backup admins cannot be removed.");
      return;
    }

    const confirmed = window.confirm(`Remove ${normalizedEmail}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("email", normalizedEmail);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Role removed.");
  }

  async function suspendUser() {
    if (!isAdmin) return;

    const email = suspendEmail.trim().toLowerCase();

    if (!email) {
      alert("Enter an email.");
      return;
    }

    const { error } = await supabase.from("user_suspensions").upsert(
      {
        email,
        reason: suspendReason || "Suspended by admin",
        active: true,
        starts_at: new Date().toISOString(),
      },
      {
        onConflict: "email",
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setSuspendEmail("");
    setSuspendReason("");
    await loadData();
    alert("User suspended.");
  }

  async function unsuspendUser(email: string) {
    if (!isAdmin) return;

    const { error } = await supabase
      .from("user_suspensions")
      .update({ active: false })
      .eq("email", email);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("User unsuspended.");
  }

  async function createRecurringBooking() {
    if (!user?.email) {
      alert("Please log in first.");
      return;
    }

    if (isPastDate(recurringStartDate) || isPastDate(recurringEndDate)) {
      alert("You cannot create recurring bookings in the past.");
      return;
    }

    if (recurringEndDate < recurringStartDate) {
      alert("End date must be after start date.");
      return;
    }

    const duration = minutesBetween(recurringStartTime, recurringEndTime);

    if (duration < 30) {
      alert("Minimum booking time is 30 minutes.");
      return;
    }

    if (!hasUnlimitedBooking && duration > 120) {
      alert("Students can only book up to 2 hours at once.");
      return;
    }

    if (!hasUnlimitedBooking) {
      const suspended = await checkSuspension();
      if (suspended) return;
    }

    const bookeeEmail = (isAdmin ? recurringBookeeEmail : user.email)
      .trim()
      .toLowerCase();
    const bookeeName =
      isAdmin && bookeeEmail !== user.email.toLowerCase()
        ? recurringBookeeName.trim()
        : displayNameFromUser(user);

    if (!bookeeEmail) {
      alert("Bookee email is required.");
      return;
    }

    const response = await fetch("/api/recurring-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: recurringRoom,
        startDate: recurringStartDate,
        endDate: recurringEndDate,
        weekday: recurringWeekday,
        startTime: recurringStartTime,
        endTime: recurringEndTime,
        remark: recurringRemark,
        email: bookeeEmail,
        userName: bookeeName,
        hasUnlimitedBooking,
      }),
    });

    const data = await response.json();

    alert(data.message);

    setShowRecurringModal(false);
    setRecurringBookeeEmail("");
    setRecurringBookeeName("");
    await loadData();
  }

  function handleDateChange(newDate: string) {
    if (isPastDate(newDate)) {
      alert("You cannot book a past date.");
      return;
    }

    setSelection(null);
    setHoverTime(null);
    setDate(newDate);
  }

  return (
    <>
      {bookingDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold">Confirm Practice Room Booking</h2>

            <p className="text-gray-600">
              Room {bookingDraft.room.room_number} · {date} · {formatTime12(bookingDraft.start)}-{formatTime12(bookingDraft.end)}
            </p>

            <div>
              <label className="block text-sm font-semibold mb-1">Book for email</label>
              <input
                value={bookingDraft.bookeeEmail}
                disabled={!isAdmin}
                onChange={(e) =>
                  setBookingDraft({ ...bookingDraft, bookeeEmail: e.target.value })
                }
                className="border rounded-lg px-4 py-2 w-full disabled:bg-gray-100"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-semibold mb-1">Book for name</label>
                <input
                  value={bookingDraft.bookeeName}
                  onChange={(e) =>
                    setBookingDraft({ ...bookingDraft, bookeeName: e.target.value })
                  }
                  className="border rounded-lg px-4 py-2 w-full"
                  placeholder="Student or instructor name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1">Note</label>
              <textarea
                value={bookingDraft.remark}
                onChange={(e) =>
                  setBookingDraft({ ...bookingDraft, remark: e.target.value })
                }
                className="border rounded-lg px-4 py-2 w-full"
                placeholder="Optional note"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setBookingDraft(null);
                  setSelection(null);
                  setHoverTime(null);
                }}
                className="border px-4 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={confirmBookingDraft}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div>
              <h2 className="text-2xl font-bold">
                {cancelDraft.recurring_series_id ? "Cancel Recurring Booking" : "Cancel Booking"}
              </h2>
              <p className="text-gray-600 mt-2">
                {roomName(cancelDraft.room_id)} · {cancelDraft.booking_date} · {formatTime12(cancelDraft.start_time)}-
                {formatTime12(cancelDraft.end_time)}
              </p>
              {cancelDraft.recurring_series_id && (
                <p className="text-sm text-gray-500 mt-2">
                  Choose whether to cancel only this booking or the whole recurring series.
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setCancelDraft(null)}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Keep Booking
              </button>

              <button
                onClick={() => confirmCancelBooking(cancelDraft)}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Cancel This Booking
              </button>

              {cancelDraft.recurring_series_id && (
                <button
                  onClick={() => cancelSeries(cancelDraft.recurring_series_id!)}
                  className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                >
                  Cancel All Recurring Bookings
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-2xl font-bold">Recurring Bookings</h2>

            <input
              placeholder="Room Number"
              value={recurringRoom}
              onChange={(e) => setRecurringRoom(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
            />

            <div>
              <label className="text-sm">Start Date</label>
              <KeyboardDatePicker
                id="recurring-practice-start-date"
                label="Recurring practice booking start date"
                value={recurringStartDate}
                min={localToday()}
                onChange={(value) => {
                  setRecurringStartDate(value);
                  if (recurringEndDate < value) setRecurringEndDate(value);
                }}
              />
            </div>

            <div>
              <label className="text-sm">End Date</label>
              <KeyboardDatePicker
                id="recurring-practice-end-date"
                label="Recurring practice booking end date"
                value={recurringEndDate}
                min={recurringStartDate || localToday()}
                onChange={setRecurringEndDate}
              />
            </div>

            <div>
              <label className="text-sm">Repeat Day</label>
              <select
                aria-label="Recurring practice booking repeat day"
                value={recurringWeekday}
                onChange={(e) => setRecurringWeekday(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              >
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm">Start Time</label>
                <select
                  aria-label="Recurring practice booking start time"
                  value={recurringStartTime}
                  onChange={(e) => setRecurringStartTime(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                >
                  {times.map((time) => (
                    <option key={time} value={time}>
                      {formatTime12(time)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="text-sm">End Time</label>
                <select
                  aria-label="Recurring practice booking end time"
                  value={recurringEndTime}
                  onChange={(e) => setRecurringEndTime(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                >
                  {times.map((time) => (
                    <option key={time} value={time}>
                      {formatTime12(time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              placeholder="Remark / Notes"
              value={recurringRemark}
              onChange={(e) => setRecurringRemark(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
            />

            {isAdmin && (
              <>
                <div>
                  <label className="text-sm">Book for email</label>
                  <input
                    value={recurringBookeeEmail}
                    onChange={(e) => setRecurringBookeeEmail(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="student@tc.columbia.edu"
                  />
                </div>

                <div>
                  <label className="text-sm">Book for name</label>
                  <input
                    value={recurringBookeeName}
                    onChange={(e) => setRecurringBookeeName(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="Student name"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRecurringModal(false)}
                className="border px-4 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={createRecurringBooking}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gray-100 p-8">
        {user && isAdmin && (
          <button
            onClick={() => (window.location.href = "/admin-bookings")}
            className="fixed right-8 top-8 z-50 border bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100"
          >
            Admin
          </button>
        )}

        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-gray-900">
              Practice Room Reservation
            </h1>

            <p className="text-gray-600 mt-2">
              Rooms 515A–515L · Monday–Friday · 10AM–9PM
            </p>

            {selection && (
              <p className="text-sm text-gray-700 mt-3">
                Selected start:{" "}
                <strong>
                  {selection.room.room_number} {formatTime12(selection.start)}
                </strong>
                . Move your cursor to preview, then click an end cell.
              </p>
            )}
          </div>

          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
            {user ? (
              <>
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

                {isAdmin && (
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

                <button
                  onClick={() => {
                    setRecurringBookeeEmail(user.email || "");
                    setRecurringBookeeName(displayNameFromUser(user));
                    setShowRecurringModal(true);
                  }}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Recurring Bookings
                </button>

                <button
                  onClick={() => (window.location.href = "/my-bookings")}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  My Bookings
                </button>

                <span className="text-gray-700">
                  Hello <strong>{displayNameFromUser(user)}</strong> · Logged in as <strong>{user.email}</strong>
                  {isAdmin && <span> · admin</span>}
                  {!isAdmin && isInstructor && <span> · instructor</span>}
                </span>

                <button
                  onClick={logout}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                >
                  Log out
                </button>

                {selection && (
                  <button
                    onClick={() => {
                      setSelection(null);
                      setHoverTime(null);
                    }}
                    className="border px-4 py-2 rounded-lg hover:bg-gray-100"
                  >
                    Clear Selection
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800"
              >
                Continue with TC/CU Google
              </button>
            )}

            {view === "booking" && (
              <div className="ml-auto">
                <KeyboardDatePicker
                  id="practice-booking-date"
                  label="Practice room booking date"
                  value={date}
                  min={localToday()}
                  onChange={handleDateChange}
                  className="w-40"
                />
              </div>
            )}
          </div>

          {view === "booking" && (
            <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border">
              <table
                className="min-w-full table-fixed border-collapse text-center"
                style={{ width: `${160 + times.length * 72}px` }}
              >
                <colgroup>
                  <col style={{ width: 160 }} />
                  {times.map((time) => (
                    <col key={time} style={{ width: 72 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-4 text-left border-b">Room</th>

                    {times.map((time) => (
                      <th key={time} className="p-2 text-sm font-medium border-b">
                        {formatTime12(time)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rooms.map((room, roomIndex) => (
                    <tr key={room.id}>
                      <td className="p-4 border-b font-semibold bg-gray-50 text-left">
                        <div>{room.room_number}</div>

                        {room.description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {room.description}
                          </div>
                        )}

                        {room.room_number === "515F" && (
                          <div className="text-xs text-red-500 mt-1">
                            Instructor/Admin only
                          </div>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => updateRoomDescription(room)}
                            className="text-xs text-blue-600 underline mt-1"
                          >
                            Edit description
                          </button>
                        )}
                      </td>

                      {(() => {
                        const cells: ReactNode[] = [];

                        for (let index = 0; index < times.length; index++) {
                          const time = times[index];
                          const booking = bookingForCell(room.id, time);
                          const preview = isPreview(room.id, time);
                          const past = isPastTime(date, time);

                          if (booking) {
                            if (cleanTime(booking.start_time) !== time) {
                              continue;
                            }

                            const colSpan = Math.max(
                              1,
                              Math.min(
                                Math.ceil(minutesBetween(booking.start_time, booking.end_time) / 30),
                                times.length - index
                              )
                            );

                            cells.push(
                              <td key={booking.id} colSpan={colSpan} className="border-b p-0">
                                <div
                                  title={[displayPerson(booking.user_name, booking.user_email), booking.remark].filter(Boolean).join(" · ")}
                                  className="bg-gray-300 text-gray-700 w-full h-8 border border-gray-300 text-xs overflow-hidden whitespace-nowrap px-2 flex items-center justify-center"
                                  style={{
                                    backgroundImage:
                                      "repeating-linear-gradient(to right, transparent 0, transparent 71px, rgba(107, 114, 128, 0.35) 71px, rgba(107, 114, 128, 0.35) 72px)",
                                  }}
                                >
                                  <span className="block min-w-0 truncate">
                                    {[displayPerson(booking.user_name, booking.user_email), booking.remark].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              </td>
                            );

                            continue;
                          }

                          cells.push(
                            <td key={time} className="border-b p-0">
                              <button
                                id={`practice-cell-${roomIndex}-${index}`}
                                aria-label={`${room.room_number}, ${formatTime12(time)} on ${date}${preview ? ", selected range" : ""}`}
                                disabled={past || isPastDate(date)}
                                onFocus={() => {
                                  if (selection?.room.id === room.id) {
                                    const previewEnd = cellEnd(time);

                                    if (!hasUnlimitedBooking && minutesBetween(selection.start, previewEnd) > 120) {
                                      return;
                                    }

                                    setHoverTime(time);
                                  }
                                }}
                                onKeyDown={(event) => handleCellKeyDown(event, room, time, roomIndex, index)}
                                onMouseEnter={() => {
                                  if (selection?.room.id === room.id) {
                                    const previewEnd = cellEnd(time);

                                    if (!hasUnlimitedBooking && minutesBetween(selection.start, previewEnd) > 120) {
                                      return;
                                    }

                                    setHoverTime(time);
                                  }
                                }}
                                onClick={() => handleCellClick(room, time)}
                                className={
                                  past || isPastDate(date)
                                    ? "bg-gray-100 text-gray-400 w-full h-8 cursor-not-allowed border border-gray-200 text-xs"
                                    : preview
                                    ? "bg-gray-200 w-full h-8 border border-gray-300 text-xs"
                                    : "bg-white hover:bg-gray-100 w-full h-8 border border-gray-300 text-xs"
                                }
                              />
                            </td>
                          );
                        }

                        return cells;
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === "myBookings" && (
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-3xl font-bold mb-6">My Bookings</h2>

              {myBookings.length === 0 && (
                <p className="text-gray-600">No active bookings.</p>
              )}

              <div className="space-y-4">
                {myBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-lg">
                        {roomName(booking.room_id)} · {displayPerson(booking.user_name, booking.user_email)}
                      </p>

                      <p className="text-gray-600">
                        {booking.booking_date} · {formatTime12(booking.start_time)}–
                        {formatTime12(booking.end_time)}
                      </p>

                      {booking.remark && (
                        <p className="text-gray-500 text-sm">
                          Remark: {booking.remark}
                        </p>
                      )}

                      {booking.recurring_series_id && (
                        <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">
                          Recurring
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "admin" && isAdmin && (
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-3xl font-bold mb-6">Admin: Active Bookings</h2>

              {adminBookings.length === 0 && (
                <p className="text-gray-600">No active bookings.</p>
              )}

              <div className="space-y-4">
                {adminBookings.map((booking) => (
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

                      <p className="text-gray-500 text-sm">
                        {displayPerson(booking.user_name, booking.user_email)}
                      </p>

                      {booking.remark && (
                        <p className="text-gray-500 text-sm">
                          Remark: {booking.remark}
                        </p>
                      )}

                      {booking.recurring_series_id && (
                        <span className="inline-block text-xs bg-gray-200 px-2 py-1 rounded mt-2">
                          Recurring
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "roles" && isAdmin && (
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-3xl font-bold mb-6">
                Manage Instructors & Admins
              </h2>

              <div className="flex gap-3 mb-6 flex-wrap">
                <input
                  type="email"
                  placeholder="UNI@tc.columbia.edu"
                  value={newRoleEmail}
                  onChange={(e) => setNewRoleEmail(e.target.value)}
                  className="border rounded-lg px-4 py-2"
                />

                <select
                  aria-label="Role to add or update"
                  value={newRoleType}
                  onChange={(e) =>
                    setNewRoleType(e.target.value as "admin" | "instructor")
                  }
                  className="border rounded-lg px-4 py-2"
                >
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  onClick={addRole}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Add / Update Role
                </button>
              </div>

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
                    </div>

                    <button
                      onClick={() => removeRole(role.email)}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "suspensions" && isAdmin && (
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-3xl font-bold mb-6">Suspend Users</h2>

              <div className="flex gap-3 mb-6 flex-wrap">
                <input
                  type="email"
                  placeholder="student@tc.columbia.edu"
                  value={suspendEmail}
                  onChange={(e) => setSuspendEmail(e.target.value)}
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  type="text"
                  placeholder="Reason"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="border rounded-lg px-4 py-2"
                />

                <button
                  onClick={suspendUser}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Suspend
                </button>
              </div>

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
