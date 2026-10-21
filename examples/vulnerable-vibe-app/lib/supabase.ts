import { createClient } from "@supabase/supabase-js";

// "Use the service role so we don't get permission errors"
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);
