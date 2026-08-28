'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '@/lib/supabase/client';
import type { PublicBoard } from '@/lib/types';
import { formatClock } from '@/lib/geo';
import { Spinner } from '@/components/Chrome';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const MEDAL: Record<number, string> = {
  1: 'linear-gradient(#f2cd7c,#b8873a)',
  2: 'linear-gradient(#e2dcce,#a9a294)',
  3: 'linear-gradient(#dcac7e,#a5734a)',
};

/**
 * The lobby projection. Public, no login, and deliberately ONE connection for
 * the whole room rather than one per viewer — the free realtime tier allows 200
 * concurrent sockets and the crews need them more than the audience does.
 */
export function BigScreen({ huntId }: { huntId: string }) {
  const supabase = useMemo(() => sb(), []);
  const [data, setData] = useState<PublicBoard | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [hi, setHi] = useState(0);

  const load = useCallback(async () => {
    const { data: res } = await supabase.rpc('public_board', { p_hunt: huntId });
    const b = res as PublicBoard;
    setData(b);
    if (b?.ok) setRemaining(b.hunt.remaining_s);
  }, [supabase, huntId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setHi((h) => h + 1), 3400);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return <main className="flex min-h-dvh items-center justify-center" style={{ background: '#070d11' }}>
      <Spinner label="Waiting for the hunt" />
    </main>;
  }
  if (!data.ok) {
    return <main className="flex min-h-dvh items-center justify-center" style={{ background: '#070d11' }}>
      <p className="font-display text-3xl text-[#f6ecd6]">NO PUBLIC BOARD FOR THIS HUNT</p>
    </main>;
  }

  const { hunt, board, feed, per_clue } = data;
  const top = board.slice(0, 6);
  const highlight = top.length ? hi % top.length : 0;
  const latest = feed.find((f) => f.kind === 'arrival_ok' || f.kind === 'finish');
  const maxSolved = Math.max(1, ...per_clue.map((c) => c.solved));

  return (
    <main
      className="relative flex min-h-dvh flex-col overflow-hidden"
      style={{
        background: 'radial-gradient(110% 80% at 50% 0%,#1d3745 0%,#101f28 48%,#070d11 100%)',
        color: '#f0e6cf',
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[120px] h-[1600px] w-[1600px] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]"
        style={{ background: 'repeating-conic-gradient(from 0deg,#e0b25c 0deg 3deg,transparent 3deg 14deg)' }}
      />

      <header
        className="relative flex flex-wrap items-end justify-between gap-8 px-14 pb-6 pt-10"
        style={{ borderBottom: '3px solid #2d4453' }}
      >
        <div className="flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-3 self-start bg-wax px-3.5 pb-1.5 pt-1.5">
            <span className="anim-pulse h-2.5 w-2.5 rounded-full bg-[#fff3ef]" />
            <span className="font-mono text-xs font-bold tracking-[0.3em] text-[#fff3ef]">
              {hunt.status === 'ended' ? 'THE HUNT IS ENDED' : 'LIVE FROM THE CAMPUS'}
            </span>
          </span>
          <h1 className="font-display text-[clamp(38px,5vw,66px)] leading-[0.92] tracking-[-0.03em] text-[#f6ecd6]">
            {hunt.name.toUpperCase()}
          </h1>
        </div>
        <div className="flex items-end gap-11">
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[11px] font-bold tracking-[0.26em] text-[#7f9aab]">CREWS</span>
            <span className="font-display text-[clamp(30px,4vw,50px)] leading-none text-[#f6ecd6]">{hunt.crews}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[11px] font-bold tracking-[0.26em] text-[#7f9aab]">TIME REMAINING</span>
            <span className="font-display text-[clamp(36px,5vw,62px)] leading-none text-brass">
              {formatClock(remaining)}
            </span>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col gap-8 px-14 py-6 xl:flex-row">
        <section className="flex flex-1 flex-col">
          {top.map((r, i) => {
            const on = i === highlight;
            return (
              <div
                key={r.team_id}
                className="flex items-center gap-7 px-5 py-3.5 transition-all duration-500"
                style={{
                  borderBottom: '1px solid #1e2f3a',
                  background: on ? 'rgba(224,178,92,0.12)' : 'transparent',
                  transform: on ? 'translateX(10px)' : 'none',
                }}
              >
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-[26px]"
                  style={{
                    background: MEDAL[r.rank] ?? 'transparent',
                    border: `3px solid ${MEDAL[r.rank] ? '#f6ecd6' : '#2d4453'}`,
                    boxShadow: MEDAL[r.rank] ? '0 5px 0 rgba(0,0,0,0.35)' : undefined,
                    color: MEDAL[r.rank] ? '#241a12' : '#7f9aab',
                  }}
                >
                  {ROMAN[r.rank - 1] ?? r.rank}
                </span>
                <span className="flex min-w-0 flex-grow flex-col gap-1">
                  <span className="truncate font-display text-[clamp(22px,2.6vw,32px)] leading-none tracking-[-0.022em] text-[#f6ecd6]">
                    {r.name.toUpperCase()}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.16em] text-[#7f9aab]">
                    {r.solved} MARKS &middot; {r.hints === 0 ? 'NO HINTS' : `${r.hints} HINTS`}
                    {r.finished && ' · HOME'}
                  </span>
                </span>
                <span className="min-w-[110px] shrink-0 text-right font-display text-[clamp(28px,3.4vw,46px)] leading-none text-[#f6ecd6]">
                  {r.score}
                </span>
              </div>
            );
          })}
          {top.length === 0 && (
            <p className="py-16 text-center font-body text-xl italic text-[#7f9aab]">
              No crews on the board yet.
            </p>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[420px]">
          {latest && (
            <div className="flex flex-col gap-3 px-6 pb-6 pt-6"
              style={{ background: 'rgba(224,178,92,0.11)', border: '3px solid #8a6a2c' }}>
              <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-brass">JUST NOW</span>
              <span className="font-display text-[clamp(22px,2.4vw,32px)] leading-tight tracking-[-0.022em] text-[#f6ecd6]">
                {(latest.team ?? '').toUpperCase()}
              </span>
              <span className="font-body text-lg font-semibold leading-snug text-[#c4d4de]">
                {latest.kind === 'finish' ? 'came home.' : `took ${latest.label ?? 'a mark'}.`}
              </span>
              {latest.points && (
                <span className="font-display text-[clamp(28px,3vw,46px)] leading-none text-[#8fd6a0]">
                  +{latest.points}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 px-6 pb-5 pt-5" style={{ border: '3px solid #2d4453' }}>
            <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-[#7f9aab]">MARKS CLEARED</span>
            <div className="flex h-24 items-end gap-1.5">
              {per_clue.map((c) => (
                <div
                  key={c.seq}
                  title={`${c.label}: ${c.solved}`}
                  className="flex-grow"
                  style={{
                    height: `${Math.max(6, (c.solved / maxSolved) * 100)}%`,
                    background: c.solved === maxSolved ? '#e0b25c' : '#3c5a68',
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between font-mono text-[11px] tracking-[0.12em] text-[#6f8797]">
              <span>MARK I</span>
              <span>MARK {ROMAN[Math.max(0, per_clue.length - 1)] ?? per_clue.length}</span>
            </div>
          </div>
        </aside>
      </div>

      <footer
        className="relative flex h-16 shrink-0 items-center overflow-hidden"
        style={{ borderTop: '3px solid #2d4453', background: 'rgba(7,13,17,0.75)' }}
      >
        <span className="shrink-0 px-6 font-mono text-[11px] font-bold leading-[64px] tracking-[0.28em] text-brass"
          style={{ borderRight: '2px solid #2d4453' }}>
          THE LOG
        </span>
        <div className="flex-grow overflow-hidden">
          <div className="anim-ticker flex gap-14 whitespace-nowrap font-body text-lg leading-[64px] text-[#9db4c2]">
            {[...feed, ...feed].map((f, i) => (
              <span key={i}>
                {f.kind === 'announce' ? <i>a message from race control</i>
                  : <><b className="text-[#f6ecd6]">{f.team}</b>{' '}
                      {f.kind === 'finish' ? 'came home' : <>cleared <b className="text-brass">{f.label}</b></>}</>}
              </span>
            ))}
            {feed.length === 0 && <span>waiting for the first mark…</span>}
          </div>
        </div>
      </footer>
    </main>
  );
}
