'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sb } from '@/lib/supabase/client';
import { chime, thunk } from '@/lib/sound';
import { ErrorNote, MonoLabel, WaxTag } from '@/components/Chrome';

/**
 * Organisers use email + password. Deliberately not magic links: Supabase's
 * built-in mailer sends two auth emails an hour, which is useless on event day,
 * and bringing an SMTP provider in would add an account for no gain when the
 * people signing in are a handful of club officers.
 */
export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [club, setClub] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    thunk();

    const s = sb();
    try {
      const { error: authError } =
        mode === 'in'
          ? await s.auth.signInWithPassword({ email: email.trim(), password })
          : await s.auth.signUp({ email: email.trim(), password });
      if (authError) throw new Error(authError.message);

      const { data, error: rpcError } = await s.rpc('bootstrap_org', {
        p_name: club.trim() || 'My club',
      });
      if (rpcError) throw new Error(rpcError.message);
      const res = data as { ok: boolean; reason?: string };
      if (!res.ok) throw new Error(res.reason ?? 'Could not set up your club.');

      chime();
      router.push('/studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.');
      setBusy(false);
    }
  }

  return (
    <main className="parchment grain relative flex min-h-dvh items-center justify-center px-7 py-12">
      <form onSubmit={go} className="relative w-full max-w-sm">
        <header className="flex flex-col items-center gap-2.5">
          <div className="h-[3px] w-24 bg-ink" />
          <h1 className="text-center font-display text-[36px] leading-none tracking-[-0.02em]">
            HUNT STUDIO
          </h1>
          <WaxTag>{mode === 'in' ? 'ORGANISERS ONLY' : 'START A CLUB'}</WaxTag>
        </header>

        <div className="mt-8 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <MonoLabel className="tracking-[0.2em]">EMAIL</MonoLabel>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="field h-[52px] px-3.5 font-body text-[16px]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <MonoLabel className="tracking-[0.2em]">PASSWORD</MonoLabel>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              className="field h-[52px] px-3.5 font-body text-[16px]"
            />
          </label>
          {mode === 'up' && (
            <label className="flex flex-col gap-1.5">
              <MonoLabel className="tracking-[0.2em]">YOUR CLUB</MonoLabel>
              <input
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="MDG Space"
                className="field h-[52px] px-3.5 font-body text-[16px] placeholder:text-ink-3/50"
              />
            </label>
          )}
        </div>

        {error && <div className="mt-5"><ErrorNote>{error}</ErrorNote></div>}

        <button
          type="submit"
          disabled={busy}
          className="btn-wax push mt-7 flex min-h-[66px] w-full items-center justify-center rounded"
        >
          <span className="font-display text-[22px] tracking-[-0.01em]">
            {busy ? 'ONE MOMENT…' : mode === 'in' ? 'SIGN IN' : 'CREATE THE CLUB'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }}
          className="mt-5 w-full text-center font-mono text-[10px] tracking-[0.14em] text-wax underline"
        >
          {mode === 'in' ? 'NEW CLUB? CREATE AN ACCOUNT' : 'ALREADY HAVE ONE? SIGN IN'}
        </button>

        <div className="mt-8 border-t-2 border-dashed border-rule pt-4 text-center">
          <MonoLabel className="tracking-[0.14em]">
            DEMO &middot; demo@rlandhunt.test / huntmaster
          </MonoLabel>
          <div className="mt-3">
            <Link href="/" className="font-mono text-[10px] tracking-[0.14em] text-ink-3 underline">
              PLAYING INSTEAD? GO TO THE GATE
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
}
