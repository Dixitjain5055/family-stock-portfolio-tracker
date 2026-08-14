import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseConfig } from "./config";

export function createSupabaseAdminClient() {
  const { url } = requirePublicSupabaseConfig();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

