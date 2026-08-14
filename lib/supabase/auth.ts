import "server-only";
import { createSupabaseAdminClient } from "./admin";
import { createSupabaseServerClient } from "./server";

export function isAuthDisabled() {
  return process.env.AUTH_DISABLED === "true";
}

function requirePortfolioOwnerId() {
  const ownerId = process.env.PORTFOLIO_OWNER_ID;
  if (!ownerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error("PORTFOLIO_OWNER_ID is not configured for single-tenant mode.");
  }
  return ownerId;
}

export async function requireUser() {
  if (isAuthDisabled()) {
    const supabase = createSupabaseAdminClient();
    return { supabase, user: { id: requirePortfolioOwnerId() } };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return { supabase, user: data.user };
}

export async function ownsMember(memberId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("family_members")
    .select("id")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { supabase, user, owns: Boolean(data) };
}
