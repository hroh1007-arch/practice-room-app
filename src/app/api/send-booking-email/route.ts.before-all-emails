import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      type,
      email,
      room,
      date,
      startTime,
      endTime,
    } = body;

    const isCancel = type === "cancel";

    const subject = isCancel
      ? "Practice Room Booking Cancelled"
      : "Practice Room Booking Confirmed";

    const title = isCancel
      ? "Booking Cancelled"
      : "Booking Confirmed";

    const message = isCancel
      ? "Your practice room reservation has been cancelled."
      : "Your practice room reservation has been confirmed.";

    const data = await resend.emails.send({
      from: "TC Practice Rooms <onboarding@resend.dev>",
      to: [email],
      subject,
      html: `
        <h2>${title}</h2>

        <p>${message}</p>

        <ul>
          <li><strong>Room:</strong> ${room}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${startTime} - ${endTime}</li>
        </ul>

        <p>TC Music & Music Education</p>
      `,
    });

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
