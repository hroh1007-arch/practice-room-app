import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

function displayNameFromAuthUser(user: {
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
}) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    ""
  );
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return NextResponse.json({ message: "Missing token." }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const requesterEmail = user.email.toLowerCase();
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("email", requesterEmail)
    .maybeSingle();

  const isAdmin =
    roleData?.role === "admin" || backupAdminEmails.includes(requesterEmail);

  if (!isAdmin) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const body = await req.json();
  const requestedEmails = Array.isArray(body.emails)
    ? body.emails
        .filter((email: unknown): email is string => typeof email === "string")
        .map((email: string) => email.toLowerCase())
    : [];
  const requested = new Set(requestedEmails);

  if (requested.size === 0) {
    return NextResponse.json({ names: {} });
  }

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const names = Object.fromEntries(
    data.users
      .filter((authUser) => authUser.email && requested.has(authUser.email.toLowerCase()))
      .map((authUser) => [
        authUser.email!.toLowerCase(),
        displayNameFromAuthUser(authUser),
      ])
  );

  return NextResponse.json({ names });
}
