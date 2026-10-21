import { createClient } from "@supabase/supabase-js";

// FAKE demo service_role JWT (dummy signature): appsecradar should flag this.
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYmVndWFyZGRlbW8iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.DEMO-not-a-real-signature-appsecradar";

export const supabaseAdmin = createClient("https://appsecradardemo.supabase.co", SUPABASE_SERVICE_ROLE_KEY);
