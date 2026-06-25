import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

function minutesBetween(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function addDays(date: string, days: number) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + days);
  return localDateString(next);
}

function getWeekRange(selectedDate: string) {
  const dateObj = new Date(selectedDate + "T00:00:00");
  const day = dateObj.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(selectedDate, diffToMonday);
  const sunday = addDays(monday, 6);

  return { start: monday, end: sunday };
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    room,
    startDate,
    endDate,
    weekday,
    startTime,
    endTime,
    remark,
    email,
    userName,
    hasUnlimitedBooking,
  } = body;

  if (!room || !startDate || !endDate || !weekday || !startTime || !endTime || !email) {
    return NextResponse.json({
      message: "Missing required fields.",
    });
  }

  const { data: roomData } = await supabase
    .from("practice_rooms")
    .select("*")
    .eq("room_number", room)
    .single();

  if (!roomData) {
    return NextResponse.json({
      message: "Room not found.",
    });
  }

  const seriesId = randomUUID();
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const duration = minutesBetween(startTime, endTime);
  const unlimited = Boolean(hasUnlimitedBooking);

  let created = 0;
  let skippedConflicts = 0;
  let skippedWeekends = 0;
  let skippedLimits = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();

    if (day === 0 || day === 6) {
      skippedWeekends++;
      continue;
    }

    if (day !== Number(weekday)) {
      continue;
    }

    const bookingDate = localDateString(d);

    const { data: conflict } = await supabase
      .from("bookings")
      .select("*")
      .eq("room_id", roomData.id)
      .eq("booking_date", bookingDate)
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (conflict && conflict.length > 0) {
      skippedConflicts++;
      continue;
    }

    if (!unlimited) {
      if (duration > 120) {
        skippedLimits++;
        continue;
      }

      const { data: dailyBookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_email", email)
        .eq("booking_date", bookingDate);

      const dailyMinutes =
        dailyBookings?.reduce(
          (total, booking) => total + minutesBetween(booking.start_time, booking.end_time),
          0
        ) || 0;

      if (dailyMinutes + duration > 120) {
        skippedLimits++;
        continue;
      }

      const { start: weekStart, end: weekEnd } = getWeekRange(bookingDate);
      const { data: weeklyBookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_email", email)
        .gte("booking_date", weekStart)
        .lte("booking_date", weekEnd);

      const weeklyMinutes =
        weeklyBookings?.reduce(
          (total, booking) => total + minutesBetween(booking.start_time, booking.end_time),
          0
        ) || 0;

      if (weeklyMinutes + duration > 300) {
        skippedLimits++;
        continue;
      }
    }

    const { error } = await supabase.from("bookings").insert({
      room_id: roomData.id,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      user_email: email,
      user_name: userName || null,
      remark: remark || "",
      checked_in: unlimited,
      checked_in_at: unlimited ? new Date().toISOString() : null,
      recurring_series_id: seriesId,
    });

    if (!error) {
      created++;
    }
  }

  return NextResponse.json({
    message: `Created ${created} recurring bookings. Skipped ${skippedConflicts} conflicts and ${skippedLimits} limit conflicts. Weekends are never included.`,
  });
}
