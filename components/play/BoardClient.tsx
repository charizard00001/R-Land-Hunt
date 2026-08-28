'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabase/client';
import type { BoardRow, GameState } from '@/lib/types';
import { formatClock } from '@/lib/geo';
import { page as pageSound, tick } from '@/lib/sound';
import { MonoLabel, Spinner } from '@/components/Chrome';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const MEDAL: Record<number, { bg: string; ink: string }> = {
  1: { bg: 'linear-gradient(#f2cd7c,#b8873a)', ink: '#241a12' },
  2: { bg: 'linear-gradient(#e2dcce,#a9a294)', ink: '#241a12' },
  3: { bg: 'linear-gradient(#dcac7e,#a5734a)', ink: '#241a12' },
};

export function BoardClient({ teamId }: { teamId: string }) {
  const supabase = useMemo(() => sb(), []);
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [meta, setMeta] = useState<{ name: string; remaining: number; huntId: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: gs } = await supabase.rpc('game_state', { p_team: teamId });
    const s = gs as GameState;
    if (!s?.ok) return;
    setMeta({ name: s.hunt.name, remaining: s.hunt.remaining_s, huntId: s.hunt.id });
    const { data } = await supabase.rpc('leaderboard', { p_hunt: s.hunt.id });
    setRows((data as BoardRow[]) ?? []);
  }, [supabase, teamId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 12000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!meta) return;
    const ch = supabase
      .channel(`board:${meta.huntId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `hunt_id=eq.${meta.huntId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase, meta, load]);

  const mine = rows?.find((r) => r.team_id === teamId);
  const gap = mine && rows ? (rows.find((r) => r.rank === 3)?.score ?? 0) - mine.score : 0;

  return (
    <main
      className="grain relative flex min-h-dvh flex-col overflow-hidden"
      style={{ background: 'linear-gradient(#f2e6c8 0%,#e2d4b1 55%,#cfbe96 100%)' }}
    >
      <div className="pointer-events-none absolute left-[52px] inset-y-0 w-0.5 bg-wax/30" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-6">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-[34px] leading-none tracking-[-0.022em]">THE RECKONING</h1>
            <span className="flex items-center gap-1.5 bg-wax px-2.5 pb-1.5 pt-1">
              <span className="anim-pulse h-1.5 w-1.5 rounded-full bg-wax-ink" />
              <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-wax-ink">LIVE</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2.5 border-b-[3px] border-ink pb-3">
            <MonoLabel className="tracking-[0.16em]">
              {rows?.length ?? 0} CREWS AFLOAT{meta ? ` · ${formatClock(meta.remaining)} REMAINS` : ''}
            </MonoLabel>
            <button
              type="button"
              onClick={() => { pageSound(); void load(); }}
              className="font-mono text-[9px] font-bold tracking-[0.14em] text-wax underline"
            >
              TURN THE PAGE
            </button>
          </div>
        </header>

        {!rows ? (
          <Spinner label="Reading the ledger" />
        ) : (
          <div className="flex-1">
            {rows.map((r) => {
              const medal = MEDAL[r.rank];
              const isMine = r.team_id === teamId;
              const isOpen = open === r.team_id;
              return (
                <button
                  key={r.team_id}
                  type="button"
                  onClick={() => { tick(); setOpen(isOpen ? null : r.team_id); }}
                  className="w-full text-left"
                  style={{ background: isMine ? 'rgba(184,51,42,0.07)' : undefined }}
                >
                  <div
                    className="flex h-[66px] items-center gap-3"
                    style={{ borderBottom: '1px solid rgba(120,100,66,0.24)' }}
                  >
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-display text-[15px]"
                      style={{
                        background: medal?.bg ?? 'transparent',
                        border: `2px solid ${medal ? '#241a12' : 'rgba(122,103,73,0.45)'}`,
                        boxShadow: medal ? '0 3px 0 rgba(36,26,18,0.5)' : undefined,
                        color: medal?.ink ?? '#7a6749',
                      }}
                    >
                      {ROMAN[r.rank - 1] ?? r.rank}
                    </span>
                    <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                      <span
                        className="truncate font-body text-[17px] font-bold leading-tight"
                        style={{ color: isMine ? '#b8332a' : '#241a12' }}
                      >
                        {r.name}
                      </span>
                      <MonoLabel className="tracking-[0.12em]">
                        {r.solved} MARKS &middot; {r.hints === 0 ? 'NO HINTS' : `${r.hints} HINT${r.hints > 1 ? 'S' : ''}`}
                      </MonoLabel>
                    </span>
                    {r.finished && (
                      <span className="shrink-0 px-1.5 pb-1 pt-0.5 font-mono text-[9px] font-bold tracking-[0.06em]"
                        style={{ background: '#2f5d3a', color: '#eaf6ec' }}>
                        HOME
                      </span>
                    )}
                    <span className="min-w-[56px] shrink-0 text-right font-display text-2xl">{r.score}</span>
                  </div>
                  {isOpen && (
                    <p className="anim-unfurl pb-3 pl-[47px] font-body text-[15px] font-medium italic text-ink-2">
                      {isMine ? 'That is you.' : `${r.name} has cleared ${r.solved} of the marks.`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {mine && (
          <div
            className="relative mt-4 rotate-[-0.7deg] px-4 pb-4 pt-3.5"
            style={{
              background: 'linear-gradient(#f8eed4,#e8dab6)',
              border: '3px solid #b8332a',
              boxShadow: '0 6px 0 #8d2019, 0 14px 22px rgba(45,30,14,0.28)',
            }}
          >
            <span
              className="absolute left-1/2 -top-[11px] h-5 w-5 -translate-x-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle at 34% 28%,#e05a4c,#96231d 60%,#5c1310)',
                boxShadow: '0 2px 5px rgba(40,10,8,0.55)',
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-wax">YOUR CREW</span>
                <span className="font-display text-[22px] leading-none">{mine.name.toUpperCase()}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-display text-[30px] leading-none text-wax">{ROMAN[mine.rank - 1] ?? mine.rank}</span>
                <span className="font-mono text-[9px] tracking-[0.12em] text-moss">
                  {mine.rank <= 3 ? 'ON THE PODIUM' : gap > 0 ? `${gap} BEHIND THIRD` : 'CLOSING IN'}
                </span>
              </div>
            </div>
          </div>
        )}

        <Link
          href={`/play/${teamId}`}
          onClick={() => pageSound()}
          className="btn-dark push mt-4 flex min-h-[54px] items-center justify-center font-display text-lg"
        >
          BACK TO THE HUNT
        </Link>
      </div>
    </main>
  );
}
