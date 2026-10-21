import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const event = await req.json();

  if (event.type === "checkout.session.completed") {
    const userId = event.data.object.client_reference_id;
    await supabaseAdmin.from("profiles").update({ plan: "pro" }).eq("id", userId);
  }

  return NextResponse.json({ received: true });
}
