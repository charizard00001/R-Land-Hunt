'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sb } from '@/lib/supabase/client';
import { isConfigured } from '@/lib/supabase/env';
import { SetupNotice } from '@/components/SetupNotice';
import { reasonText } from '@/lib/types';
import { chime, crack, tick, buzz } from '@/lib/sound';
import { ErrorNote, MonoLabel, SoundToggle, WaxTag } from '@/components/Chrome';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [team, setTeam] = useState('');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  if (!isConfigured) return <SetupNotice />;

  const cells = Array.from({ length: 6 }, (_, i) => code[i] ?? '');
  const ready = code.length === 6 && team.trim().length >= 2;

  async function join() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    crack();
    buzz([12, 40, 24]);

    try {
      const s = sb();
      // Players never make an account: an anonymous session is their passage.
      const { data: session } = await s.auth.getSession();
      if (!session.session) {
        const { error } = await s.auth.signInAnonymously();
        if (error) throw new Error(error.message);
      }

      const { data, error } = await s.rpc('join_hunt', {
        p_join_code: code,
        p_team_name: team.trim(),
        p_display_name: who.trim() || 'Crew member',
      });
      if (error) throw new Error(error.message);

      const res = data as { ok: boolean; reason?: string; team_id?: string };
      if (!res.ok) {
        setError(reasonText(res.reason));
        setBusy(false);
        return;
      }

      setOpened(true);
      chime();
      buzz([16, 50, 16, 50, 30]);
      setTimeout(() => router.push(`/play/${res.team_id}`), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the harbour master.');
      setBusy(false);
    }
  }

  return (
    <main className="parchment grain relative flex min-h-dvh flex-col overflow-hidden">
      <div className="absolute right-4 top-4 z-10">
        <SoundToggle />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-col px-7 pb-8 pt-14">
        <header className="flex flex-col items-center gap-2.5">
          <div className="h-[3px] w-24 bg-ink" />
          <h1 className="text-center font-display text-[42px] leading-[0.98] tracking-[-0.02em]">
            R-LAND
            <br />
            HUNT
          </h1>
          <WaxTag>SEALED ORDERS</WaxTag>
        </header>

        <section className="mt-9 flex flex-col items-center gap-3.5">
          <MonoLabel className="tracking-[0.22em]">ENTER THE CIPHER FROM YOUR CAPTAIN</MonoLabel>

          <div className="relative">
            <div className="flex gap-2" onClick={() => codeRef.current?.focus()}>
              {cells.map((ch, i) => {
                const isCaret = i === code.length;
                return (
                  <div
                    key={i}
                    className="field flex h-[58px] w-[44px] items-center justify-center font-display text-[25px]"
                    style={isCaret ? { borderColor: '#b8332a', boxShadow: '0 3px 0 #8d2019' } : undefined}
                  >
                    {ch || (isCaret ? <span className="anim-pulse h-[26px] w-[3px] bg-wax" /> : null)}
                  </div>
                );
              })}
            </div>
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => {
                const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                if (next.length > code.length) tick();
                setCode(next);
                setError(null);
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Hunt code, six characters"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <MonoLabel className="tracking-[0.2em]">YOUR CREW NAME</MonoLabel>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value.slice(0, 40))}
              placeholder="The Salted Crew"
              className="field h-[52px] px-3.5 font-body text-[17px] font-semibold placeholder:text-ink-3/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <MonoLabel className="tracking-[0.2em]">YOUR NAME &middot; OPTIONAL</MonoLabel>
            <input
              value={who}
              onChange={(e) => setWho(e.target.value.slice(0, 40))}
              placeholder="so your crew knows who is aboard"
              className="field h-[52px] px-3.5 font-body text-[15px] placeholder:text-ink-3/50"
            />
          </label>
        </section>

        {error && (
          <div className="mt-5">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <section className="mt-9 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={join}
            disabled={!ready || busy}
            aria-label="Break the seal and join the hunt"
            className="push relative h-[172px] w-[172px] rounded-full disabled:opacity-40"
            style={{ perspective: 600 }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: opened
                  ? 'radial-gradient(circle at 33% 26%,#5aa06e,#2f5d3a 52%,#1c3d24 100%)'
                  : 'radial-gradient(circle at 33% 26%,#e05a4c,#b8332a 52%,#6a120e 100%)',
                boxShadow:
                  'inset 0 5px 14px rgba(255,200,188,0.45), inset 0 -9px 20px rgba(40,6,4,0.66), 0 14px 28px rgba(70,16,12,0.48)',
                transform: 'rotateX(16deg)',
                transition: 'background 400ms ease',
              }}
            />
            <svg viewBox="0 0 172 172" className="absolute inset-0" aria-hidden>
              <circle cx="86" cy="86" r="64" fill="none" stroke="rgba(255,210,196,0.38)" strokeWidth="2.4" />
              {opened ? (
                <path
                  d="M52 88 L76 112 L122 62"
                  fill="none"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M86 34 L97 68 L133 68 L104 89 L115 124 L86 103 L57 124 L68 89 L39 68 L75 68 Z"
                  fill="none"
                  stroke="rgba(255,220,206,0.7)"
                  strokeWidth="3.4"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="font-display text-2xl tracking-[-0.01em]">
              {opened ? 'ADMITTED' : busy ? 'BREAKING…' : 'BREAK THE SEAL'}
            </div>
            <MonoLabel className="tracking-[0.2em]">
              {ready ? 'ONE PRESS. THAT IS ALL IT TAKES.' : 'CIPHER AND CREW NAME FIRST'}
            </MonoLabel>
          </div>
        </section>

        <footer className="mt-auto flex flex-col items-center gap-2 pt-10">
          <div
            className="h-0.5 w-full"
            style={{ background: 'repeating-linear-gradient(90deg,#8a7351 0 6px,transparent 6px 11px)' }}
          />
          <p className="text-center font-mono text-[9px] leading-[1.8] tracking-[0.16em] text-ink-3">
            NO ACCOUNT REQUIRED &middot; YOUR CIPHER IS YOUR PASSAGE
            <br />
            LOCATION IS READ ONLY WHILE THE HUNT RUNS
          </p>
          <Link href="/signin" className="mt-2 font-mono text-[10px] tracking-[0.16em] text-wax underline">
            RUNNING THE HUNT? SIGN IN
          </Link>
        </footer>
      </div>
    </main>
  );
}
