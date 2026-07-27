import { createClient } from "@supabase/supabase-js";

// Safely resolve env vars across both Vite client & Node server environments
const getEnvVar = (viteKey: string, nodeKey?: string) => {
  if (typeof import.meta !== "undefined" && import.meta?.env?.[viteKey]) {
    return import.meta.env[viteKey];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[viteKey] || (nodeKey ? process.env[nodeKey] : undefined);
  }
  return undefined;
};

const supabaseUrl = getEnvVar("VITE_SUPABASE_URL", "SUPABASE_URL");
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not configured. Auth features will be limited. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);