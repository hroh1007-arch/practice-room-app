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

function isBlockedDate(date: string, rows: any[]) {
  return rows.some((row) => {
    const start = row.start_date || row.starts_at?.slice(0, 10) || date;
    const end = row.end_date || row.ends_at?.slice(0, 10) || "9999-12-31";
    return row.active && row.email?.startsWith("blocked-day-") && date >= start && date <= end;
  });
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
  } = body;

  if (
    !room ||
    !startDate ||
    !endDate ||
    !weekday ||
    !startTime ||
    !endTime ||
    !email
  ) {
    return NextResponse.json({
      message: "Missing required fields.",
    });
  }

  const { data: roomData } = await supabase
    .from("classrooms")
    .select("*")
    .eq("room_number", room)
    .single();

  if (!roomData) {
    return NextResponse.json({
      message: "Classroom not found.",
    });
  }

  const seriesId = randomUUID();

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  let created = 0;
  let skippedConflicts = 0;
  let skippedWeekends = 0;
  let skippedBlockedDays = 0;

  const { data: blockedDays } = await supabase
    .from("user_suspensions")
    .select("*")
    .eq("active", true)
    .like("email", "blocked-day-%");

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    const day = d.getDay();

    if (day === 0 || day === 6) {
      skippedWeekends++;
      continue;
    }

    if (day !== Number(weekday)) {
      continue;
    }

    const bookingDate = localDateString(d);

    if (isBlockedDate(bookingDate, blockedDays || [])) {
      skippedBlockedDays++;
      continue;
    }

    const { data: conflict } = await supabase
      .from("classroom_bookings")
      .select("*")
      .eq("classroom_id", roomData.id)
      .eq("booking_date", bookingDate)
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (conflict && conflict.length > 0) {
      skippedConflicts++;
      continue;
    }

    const { error } = await supabase
      .from("classroom_bookings")
      .insert({
        classroom_id: roomData.id,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        user_email: email,
        user_name: userName || null,
        remark: remark || "",
        recurring_series_id: seriesId,
      });

    if (!error) {
      created++;
    }
  }

  return NextResponse.json({
    message: `Created ${created} recurring classroom bookings. Skipped ${skippedConflicts} conflicts and ${skippedBlockedDays} blocked days.`,
  });
}
