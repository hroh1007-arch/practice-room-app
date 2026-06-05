import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();

  const {
    room,
    startDate,
    endDate,
    day,
    startTime,
    endTime,
    email,
  } = body;

  const { data: roomData } = await supabase
    .from("practice_rooms")
    .select("*")
    .eq("room_number", room)
    .single();

  if (!roomData) {
    return NextResponse.json({
      message: "Room not found",
    });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  let created = 0;

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    if (d.getDay() !== Number(day)) continue;

    const bookingDate = d.toISOString().split("T")[0];

    await supabase.from("bookings").insert({
      room_id: roomData.id,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      user_email: email,
      checked_in: true,
    });

    created++;
  }

  return NextResponse.json({
    message: `Created ${created} recurring bookings`,
  });
}
