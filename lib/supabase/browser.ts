"use client";
import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "./config";

let client: ReturnType<typeof createBrowserClient> | undefined;
export function createSupabaseBrowserClient() {
  const { url, anonKey } = requirePublicSupabaseConfig();
  client ??= createBrowserClient(url, anonKey);
  return client;
}

