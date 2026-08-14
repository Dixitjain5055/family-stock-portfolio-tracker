export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function requirePublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase environment variables are not configured.");
  return { url, anonKey };
}

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export type SupabaseErrorStatus = {
  title: string;
  message: string;
  retryable: boolean;
};

export function getSupabaseErrorStatus(
  errors: Array<SupabaseErrorLike | null | undefined>,
): SupabaseErrorStatus {
  const diagnosticText = errors
    .flatMap((error) =>
      error ? [error.message, error.details, error.hint, error.code] : [],
    )
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isConnectionFailure = [
    "enotfound",
    "econnrefused",
    "etimedout",
    "fetch failed",
    "network error",
  ].some((marker) => diagnosticText.includes(marker));

  if (isConnectionFailure) {
    return {
      title: "Portfolio database unavailable",
      message:
        "Kinfolio cannot reach the configured Supabase project. Check the project URL and environment variables, then try again.",
      retryable: true,
    };
  }

  return {
    title: "Portfolio data could not be loaded",
    message:
      "The database returned an error. Try again, or check the Supabase schema and access policies.",
    retryable: true,
  };
}
