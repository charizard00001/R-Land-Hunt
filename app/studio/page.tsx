'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase/client';
import type { HuntRow } from '@/lib/types';
import { pin, thunk } from '@/lib/sound';
import { ErrorNote, MonoLabel, Spinner } from '@/components/Chrome';

const STATUS_TONE: Record<string, { bg: string; ink: string }> = {
  draft: { bg: '#8a6a2c', ink: '#ffeec6' },
  published: { bg: '#24507f', ink: '#e2f0ff' },
  live: { bg: '#2f5d3a', ink: '#eaf6ec' },
  paused: { bg: '#b8332a', ink: '#fbeeda' },
  ended: { bg: '#4a3826', ink: '#d8c8a2' },
  archived: { bg: '#4a3826', ink: '#d8c8a2' },
};

export default function StudioPage() {
  const supabase = useMemo(() => sb(), []);
  const router = useRouter();
  const [hunts, setHunts] = useState<HuntRow[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { router.replace('/signin'); return; }

    const { data: org } = await supabase.rpc('bootstrap_org', { p_name: 'My club' });
    const o = org as { ok: boolean; org_id?: string };
    if (o?.ok && o.org_id) setOrgId(o.org_id);

    const { data, error: qError } = await supabase
      .from('hunts')
      .select('id, org_id, name, join_code, status, duration_s, started_at, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (qError) setError(qError.message);
    setHunts((data as HuntRow[]) ?? []);
  }, [supabase, router]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!orgId || name.trim().length < 3) return;
    thunk();
    const { data, error: rpcError } = await supabase.rpc('create_hunt', {
      p_org: orgId, p_name: name.trim(), p_duration_s: 3600,
    });
    if (rpcError) { setError(rpcError.message); return; }
    const r = data as { ok: boolean; hunt_id?: string; reason?: string };
    if (!r.ok) { setError(r.reason ?? 'Could not create the hunt.'); return; }
    setName('');
    router.push(`/studio/${r.hunt_id}`);
  }

  return (
    <main className="min-h-dvh" style={{ background: '#17120d' }}>
      <header
        className="leather-grain flex h-[68px] items-center justify-between gap-6 px-6"
        style={{ borderBottom: '2px solid #0d0906', boxShadow: '0 3px 12px rgba(0,0,0,0.55)' }}
      >
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#e0b25c" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" />
          </svg>
          <span className="font-display text-[19px] tracking-[-0.012em] text-[#f6ecd6]">HUNT STUDIO</span>
        </div>
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
          className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#a08a63] underline"
        >
          SIGN OUT
        </button>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <section
          className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
          style={{ background: 'rgba(224,178,92,0.08)', border: '2px dashed #4a3826' }}
        >
          <label className="flex flex-grow flex-col gap-1.5">
            <MonoLabel className="!text-[#8a7148] tracking-[0.2em]">NAME A NEW HUNT</MonoLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Monsoon Reckoning"
              className="field h-[52px] px-3.5 font-body text-[16px] placeholder:text-ink-3/50"
            />
          </label>
          <button
            type="button"
            onClick={create}
            disabled={!orgId || name.trim().length < 3}
            className="btn-brass push flex h-[52px] items-center justify-center px-6 font-display text-base"
          >
            START A CHART
          </button>
        </section>

        {error && <div className="mt-5"><ErrorNote>{error}</ErrorNote></div>}

        {!hunts ? (
          <Spinner label="Opening the drawer" />
        ) : hunts.length === 0 ? (
          <p className="mt-10 text-center font-body text-[15px] italic text-[#8a7148]">
            No charts yet. Name one above and start pinning marks.
          </p>
        ) : (
          <ul className="mt-8 grid gap-3.5 sm:grid-cols-2">
            {hunts.map((h) => {
              const tone = STATUS_TONE[h.status] ?? STATUS_TONE.draft;
              return (
                <li key={h.id}>
                  <Link
                    href={`/studio/${h.id}`}
                    onClick={() => pin()}
                    className="push relative block px-4 pb-4 pt-4"
                    style={{
                      background: 'linear-gradient(#f4ecd4,#e5d8b6)',
                      border: '2px solid #a8946c',
                      boxShadow: '0 6px 0 #8d7a56',
                      transform: 'rotate(-0.4deg)',
                    }}
                  >
                    <span
                      className="absolute left-1/2 -top-2.5 h-[19px] w-[19px] -translate-x-1/2 rounded-full"
                      style={{
                        background: 'radial-gradient(circle at 34% 28%,#f6a49a,#96231d)',
                        boxShadow: '0 3px 5px rgba(40,16,6,0.6), inset 0 2px 3px rgba(255,255,255,0.5)',
                      }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-display text-[19px] leading-tight tracking-[-0.015em]">{h.name}</span>
                      <span
                        className="shrink-0 px-2 pb-1 pt-0.5 font-mono text-[8px] font-bold tracking-[0.14em]"
                        style={{ background: tone.bg, color: tone.ink }}
                      >
                        {h.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                      <MonoLabel className="tracking-[0.14em]">CIPHER</MonoLabel>
                      <span className="font-display text-[17px] tracking-[0.08em]">{h.join_code}</span>
                      <MonoLabel className="ml-auto tracking-[0.14em]">
                        {Math.round(h.duration_s / 60)} MIN
                      </MonoLabel>
                    </div>
                  </Link>
                  {(h.status === 'live' || h.status === 'paused' || h.status === 'ended') && (
                    <div className="mt-2 flex gap-2">
                      <Link
                        href={`/control/${h.id}`}
                        className="push flex-1 px-3 py-2 text-center font-mono text-[10px] font-bold tracking-[0.12em]"
                        style={{ border: '2px solid #4a3826', color: '#e0b25c' }}
                      >
                        RACE CONTROL
                      </Link>
                      <Link
                        href={`/screen/${h.id}`}
                        target="_blank"
                        className="push flex-1 px-3 py-2 text-center font-mono text-[10px] font-bold tracking-[0.12em]"
                        style={{ border: '2px solid #4a3826', color: '#8a7148' }}
                      >
                        BIG SCREEN
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
