import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
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
  } = body;

  const seriesId = randomUUID();

  const { data: roomData } = await supabase
    .from("practice_rooms")
    .select("*")
    .eq("room_number", room)
    .single();

  if (!roomData) {
    return NextResponse.json({ message: "Room not found" });
  }

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  let created = 0;
  let skipped = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== Number(weekday)) continue;

    const bookingDate = formatDate(d);

    const { data: conflict } = await supabase
      .from("bookings")
      .select("*")
      .eq("room_id", roomData.id)
      .eq("booking_date", bookingDate)
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (conflict && conflict.length > 0) {
      skipped++;
      continue;
    }

    await supabase.from("bookings").insert({
      room_id: roomData.id,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      user_email: email,
      remark,
      checked_in: true,
      recurring_series_id: seriesId,
    });

    created++;
  }

  return NextResponse.json({
    message: `Created ${created} recurring bookings. Skipped ${skipped} conflicts.`,
  });
}
