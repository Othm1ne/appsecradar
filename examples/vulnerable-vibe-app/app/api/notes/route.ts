import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const { userId, content } = await req.json();
  const { data, error } = await supabaseAdmin.from("notes").insert({ user_id: userId, content }).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { noteId } = await req.json();
  await supabaseAdmin.from("notes").delete().eq("id", noteId);
  return NextResponse.json({ ok: true });
}
