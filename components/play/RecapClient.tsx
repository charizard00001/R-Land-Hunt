'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabase/client';
import type { BoardRow, GameState } from '@/lib/types';
import { chime, stamp as stampSound } from '@/lib/sound';
import { ChartMap, type Marker, type Trail } from '@/components/ChartMap';
import { MonoLabel, Spinner, WaxTag } from '@/components/Chrome';

type Recap = {
  huntName: string;
  team: BoardRow;
  crews: number;
  route: { lat: number; lng: number }[];
};

const SUFFIX = (n: number) => (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

export function RecapClient({ teamId }: { teamId: string }) {
  const supabase = useMemo(() => sb(), []);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: gs } = await supabase.rpc('game_state', { p_team: teamId });
      const s = gs as GameState;
      if (!s?.ok) return;

      const [{ data: board }, { data: pings }] = await Promise.all([
        supabase.rpc('leaderboard', { p_hunt: s.hunt.id }),
        supabase.from('pings').select('geom, at').eq('team_id', teamId).order('at', { ascending: true }).limit(400),
      ]);

      const rows = (board as BoardRow[]) ?? [];
      const me = rows.find((r) => r.team_id === teamId);
      if (!me) return;

      // geom arrives as GeoJSON-ish or WKB depending on driver; ignore what we
      // cannot parse rather than guessing — the route is decoration, not truth.
      const route: { lat: number; lng: number }[] = [];
      (pings as { geom: unknown }[] | null)?.forEach((p) => {
        const g = p.geom as { coordinates?: [number, number] } | null;
        if (g?.coordinates) route.push({ lat: g.coordinates[1], lng: g.coordinates[0] });
      });

      setRecap({
        huntName: s.hunt.name,
        team: me,
        crews: rows.length,
        route,
      });
    })();
  }, [supabase, teamId]);

  useEffect(() => {
    if (recap) { stampSound(); setTimeout(chime, 180); }
  }, [recap]);

  if (!recap) {
    return (
      <main className="parchment grain flex min-h-dvh items-center justify-center">
        <Spinner label="Rolling up the chart" />
      </main>
    );
  }

  const { team } = recap;
  const centre = recap.route.length
    ? recap.route[Math.floor(recap.route.length / 2)]
    : { lat: 29.865, lng: 77.8966 };

  const markers: Marker[] = recap.route.length
    ? [
        { id: 'start', lat: recap.route[0].lat, lng: recap.route[0].lng, colour: '#8fd6a0', label: 'START' },
        { id: 'end', lat: recap.route[recap.route.length - 1].lat, lng: recap.route[recap.route.length - 1].lng, colour: '#e05a4c', label: 'END' },
      ]
    : [];
  const trails: Trail[] = recap.route.length > 1
    ? [{ id: 'route', colour: '#b8332a', points: recap.route }]
    : [];

  async function share() {
    stampSound();
    const text = `${team.name} finished ${team.rank}${SUFFIX(team.rank)} of ${recap!.crews} in ${recap!.huntName} — ${team.score} points, ${team.solved} marks.`;
    try {
      if (navigator.share) await navigator.share({ title: recap!.huntName, text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch { /* the user dismissed the sheet */ }
  }

  return (
    <main className="parchment grain relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-3.5 border-2 border-[rgba(150,124,74,0.5)]" />
      <div className="pointer-events-none absolute inset-5 border-4 border-double border-[rgba(150,124,74,0.4)]" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-7 pb-8 pt-10">
        <header className="flex flex-col items-center gap-2.5 text-center">
          <WaxTag>{recap.huntName.toUpperCase()}</WaxTag>
          <h1 className="font-display text-4xl leading-tight tracking-[-0.025em]">
            THE HUNT
            <br />
            IS ENDED
          </h1>
          <p className="font-body text-[17px] font-medium italic text-ink-3">
            {team.name} came home
          </p>
        </header>

        <div className="mt-4 flex items-end justify-center gap-2.5">
          <span className="font-display text-[84px] leading-[0.82] text-wax" style={{ textShadow: '0 3px 0 rgba(255,248,224,0.5)' }}>
            {team.rank}
            {SUFFIX(team.rank)}
          </span>
          <MonoLabel className="pb-3 tracking-[0.18em]">OF {recap.crews} CREWS</MonoLabel>
        </div>

        <div
          className="mt-3 overflow-hidden"
          style={{ border: '2px solid #a8946c', boxShadow: 'inset 0 0 24px rgba(150,120,70,0.22)' }}
        >
          <ChartMap centre={centre} spanM={1200} markers={markers} trails={trails} height={190} />
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-0.5" style={{ background: '#a8946c', border: '2px solid #a8946c' }}>
          {[
            { v: String(team.solved), l: 'MARKS' },
            { v: String(team.hints), l: 'HINTS TAKEN' },
            { v: String(team.score), l: 'SPOILS' },
          ].map((s) => (
            <div key={s.l} className="flex flex-col items-center gap-0.5 bg-[#ece0bf] px-1.5 py-3">
              <span className="font-display text-[22px] leading-none">{s.v}</span>
              <span className="font-mono text-[8px] tracking-[0.14em] text-ink-3">{s.l}</span>
            </div>
          ))}
        </div>

        {copied && (
          <div
            className="anim-pop mx-auto mt-5 px-4 py-2.5 text-center"
            style={{ background: '#241708', border: '2px solid #120c05', boxShadow: '0 5px 0 #0d0906' }}
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-brass">
              SEALED &middot; READY TO SHARE
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <button type="button" onClick={share} className="btn-brass push flex min-h-[70px] items-center justify-center gap-3 rounded">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
              <path d="M8.4 10.8l7.2-4.2M8.4 13.2l7.2 4.2" />
            </svg>
            <span className="font-display text-[23px] tracking-[-0.01em]">CARRY THIS HOME</span>
          </button>
          <Link
            href={`/play/${teamId}/leaderboard`}
            className="btn-paper push flex min-h-[50px] items-center justify-center font-mono text-[11px] font-bold tracking-[0.14em]"
          >
            THE FULL RECKONING
          </Link>
        </div>
      </div>
    </main>
  );
}
