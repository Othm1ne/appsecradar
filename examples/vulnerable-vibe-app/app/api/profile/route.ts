import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

// The correct pattern: get the user from the session, never from the request body.
export async function PATCH(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { displayName } = await req.json();
  await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
