export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until the two public keys are in .env.local. */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);
