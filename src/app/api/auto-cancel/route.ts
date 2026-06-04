import { createClient } from "@supabase/supabase-js";

type Booking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_email: string;
  checked_in: boolean;
  auto_cancelled: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function cleanTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [hour, minute] = cleanTime(time).split(":").map(Number);
  return hour * 60 + minute;
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export async function GET() {
  const today = todayDate();
  const now = nowMinutes();

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("*");

  const unlimitedEmails = new Set(
    (roles || [])
      .filter((role) => role.role === "admin" || role.role === "instructor")
      .map((role) => role.email.toLowerCase())
  );

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("booking_date", today)
    .eq("checked_in", false)
    .eq("auto_cancelled", false);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const cancelled = [];

  for (const booking of (bookings || []) as Booking[]) {
    const email = booking.user_email.toLowerCase();

    if (unlimitedEmails.has(email)) {
      continue;
    }

    const start = timeToMinutes(booking.start_time);

    if (now < start + 15) {
      continue;
    }

    await supabaseAdmin.from("no_show_records").insert({
      email: booking.user_email,
      booking_id: booking.id,
      room_id: booking.room_id,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
    });

    await supabaseAdmin
      .from("bookings")
      .update({
        auto_cancelled: true,
        no_show: true,
      })
      .eq("id", booking.id);

    await supabaseAdmin
      .from("bookings")
      .delete()
      .eq("id", booking.id);

    const { data: recentNoShows } = await supabaseAdmin
      .from("no_show_records")
      .select("*")
      .eq("email", booking.user_email)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      );

    if ((recentNoShows || []).length >= 3) {
      await supabaseAdmin.from("user_suspensions").upsert(
        {
          email: booking.user_email,
          reason: "3 no-shows within 30 days",
          active: true,
          starts_at: new Date().toISOString(),
          ends_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        {
          onConflict: "email",
        }
      );
    }

    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-booking-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "cancel",
        email: booking.user_email,
        room: "Practice Room",
        date: booking.booking_date,
        startTime: cleanTime(booking.start_time),
        endTime: cleanTime(booking.end_time),
      }),
    });

    cancelled.push(booking.id);
  }

  return Response.json({
    checked: bookings?.length || 0,
    cancelled: cancelled.length,
    cancelledIds: cancelled,
  });
}
