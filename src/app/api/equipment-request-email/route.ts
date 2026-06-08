import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const {
    action = "request",
    equipmentCode,
    itemName,
    requesterName,
    requesterUni,
    requesterEmail,
    phone,
    programme,
    instructor,
    startDate,
    startTime,
    endDate,
    endTime,
    reason,
  } = body;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      message: "Email not sent: RESEND_API_KEY is missing.",
    });
  }

  const actionLabels: Record<string, string> = {
    request: "Equipment Request Submitted",
    checkout: "Equipment Checked Out",
    return: "Equipment Returned",
    approve: "Equipment Request Approved",
    decline: "Equipment Request Declined",
  };

  const title = actionLabels[action] || "Equipment Update";

  const emailHtml = `
    <h2>${title}</h2>
    <p><strong>Equipment:</strong> ${equipmentCode || ""} ${itemName || ""}</p>
    <p><strong>Name:</strong> ${requesterName || ""}</p>
    <p><strong>UNI:</strong> ${requesterUni || ""}</p>
    <p><strong>Email:</strong> ${requesterEmail || ""}</p>
    <p><strong>Phone:</strong> ${phone || ""}</p>
    <p><strong>Programme:</strong> ${programme || ""}</p>
    <p><strong>Instructor:</strong> ${instructor || ""}</p>
    <p><strong>Start:</strong> ${startDate || ""} ${startTime || ""}</p>
    <p><strong>End:</strong> ${endDate || ""} ${endTime || ""}</p>
    <p><strong>Reason/Notes:</strong> ${reason || ""}</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TC Equipment <onboarding@resend.dev>",
      to: Array.from(new Set(["instruments@tc.columbia.edu", requesterEmail].filter(Boolean))),
      subject: `${title}: ${equipmentCode || ""} ${itemName || ""}`,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return NextResponse.json({
      message: "Email failed: " + errorText,
    });
  }

  return NextResponse.json({
    message: "Email sent.",
  });
}
