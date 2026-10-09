import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  (typeof import.meta !== "undefined" &&
  typeof (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ===
    "string"
    ? (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_SUPABASE_URL
    : undefined) ||
  "https://jtgzsnghetquhielmzdf.supabase.co";

const supabaseKey =
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== "undefined" &&
  typeof (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_SUPABASE_PUBLISHABLE_KEY === "string"
    ? (import.meta as ImportMeta & { env: Record<string, string> }).env
        .VITE_SUPABASE_PUBLISHABLE_KEY
    : undefined) ||
  "sb_publishable_JoI9O8o8Ioty40vPtTSBYQ_aGTaz6EH";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
