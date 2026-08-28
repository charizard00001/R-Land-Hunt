'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON, SUPABASE_URL } from './env';

// Next prerenders client components at build time, when .env.local may not be
// filled in yet. Falling back to inert placeholders keeps the build honest —
// the page still renders, and `isConfigured` is what decides whether the app
// tries to talk to a database.
const URL_FALLBACK = 'http://127.0.0.1:54321';
const KEY_FALLBACK = 'not-configured';

let singleton: ReturnType<typeof createBrowserClient> | null = null;

/** One client per tab, so the auth session and realtime socket are shared. */
export function sb() {
  if (!singleton) {
    singleton = createBrowserClient(SUPABASE_URL || URL_FALLBACK, SUPABASE_ANON || KEY_FALLBACK);
  }
  return singleton;
}
