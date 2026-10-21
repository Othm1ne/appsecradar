"use client";

import { createClient } from "@supabase/supabase-js";

// Anon key + publishable key are meant to be public.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
export const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// A test fixture key with an explicit ignore comment.
// appsecradar-ignore
const FIXTURE = "sk-proj-IGNORED0000fixture0000key0000ignored0000";
