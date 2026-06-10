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

  let created = 0;
  let skippedConflicts = 0;
  let skippedWeekends = 0;

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

    const { error } = await supabase.from("bookings").insert({
      room_id: roomData.id,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      user_email: email,
      user_name: userName || null,
      remark: remark || "",
      checked_in: true,
      recurring_series_id: seriesId,
    });

    if (!error) {
      created++;
    }
  }

  return NextResponse.json({
    message: `Created ${created} recurring bookings. Skipped ${skippedConflicts} conflicts. Weekends are never included.`,
  });
}
