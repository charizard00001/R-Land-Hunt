'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase/client';
import type { ActiveNode, ArrivalResult, GameState, PingResult, Target } from '@/lib/types';
import { reasonText } from '@/lib/types';
import { formatClock } from '@/lib/geo';
import { buzz, nope, page as pageSound, thunk, tick } from '@/lib/sound';
import { Compass } from '@/components/Compass';
import { ErrorNote, MonoLabel, ScorePlate, SoundToggle, Spinner, Stamp } from '@/components/Chrome';
import { HintSheet } from '@/components/play/HintSheet';
import { ArrivalOverlay } from '@/components/play/ArrivalOverlay';
import { SimPanel } from '@/components/play/SimPanel';

type Pos = { lat: number; lng: number; acc: number | null };

const PING_EVERY_MS = 8000;
const STATE_EVERY_MS = 15000;

export function PlayClient({ teamId }: { teamId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => sb(), []);

  const [state, setState] = useState<GameState | null>(null);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [stamp, setStamp] = useState<{ title: string; sub?: string } | null>(null);
  const [arrival, setArrival] = useState<ArrivalResult | null>(null);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [simOn, setSimOn] = useState(false);

  const posRef = useRef<Pos | null>(null);
  posRef.current = pos;
  const simRef = useRef(false);
  simRef.current = simOn;

  const allowSim = process.env.NEXT_PUBLIC_ALLOW_SIM === 'true';

  // ── state ────────────────────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    const { data, error } = await supabase.rpc('game_state', { p_team: teamId });
    if (error) return;
    const s = data as GameState;
    setState(s);
    if (s.ok) {
      setRemaining(s.hunt.remaining_s);
      setActiveIdx((i) => Math.min(i, Math.max(0, s.active.length - 1)));
    }
  }, [supabase, teamId]);

  useEffect(() => {
    void loadState();
    const t = setInterval(() => void loadState(), STATE_EVERY_MS);
    return () => clearInterval(t);
  }, [loadState]);

  const huntId = state?.ok ? state.hunt.id : null;
  const huntStatus = state?.ok ? state.hunt.status : null;

  // Nudge on any change to our own progress or the hunt clock.
  useEffect(() => {
    if (!huntId) return;
    const ch = supabase
      .channel(`hunt:${huntId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hunts', filter: `id=eq.${huntId}` }, () => void loadState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress', filter: `team_id=eq.${teamId}` }, () => void loadState())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase, huntId, teamId, loadState]);

  // Local countdown between server reads, so the clock never looks frozen.
  useEffect(() => {
    if (huntStatus !== 'live') return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [huntStatus]);

  // ── position ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (simOn) return;
    if (!('geolocation' in navigator)) {
      setGeoError('This device cannot report a position.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError(null);
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
      },
      (err) => setGeoError(err.code === err.PERMISSION_DENIED
        ? 'Location is switched off. The hunt needs it to know you arrived.'
        : 'Cannot get a fix yet. Step into the open.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [simOn]);

  const sendPing = useCallback(async () => {
    const p = posRef.current;
    if (!p) return;
    const { data, error } = await supabase.rpc('record_ping', {
      p_team: teamId, p_lat: p.lat, p_lng: p.lng, p_accuracy: p.acc,
    });
    if (error) return;
    const r = data as PingResult;
    if (r.ok) {
      const next: Record<string, Target> = {};
      r.targets.forEach((t) => { next[t.node_id] = t; });
      setTargets(next);
    }
  }, [supabase, teamId]);

  useEffect(() => {
    if (!pos) return;
    void sendPing();
    const t = setInterval(() => void sendPing(), PING_EVERY_MS);
    return () => clearInterval(t);
  }, [pos, sendPing]);

  // ── actions ──────────────────────────────────────────────────────────────
  const active: ActiveNode | null = state?.ok ? state.active[activeIdx] ?? null : null;
  const target = active ? targets[active.node_id] ?? null : null;

  async function check() {
    if (!active || checking) return;
    const p = posRef.current;
    if (!p) {
      setGeoError('No position yet. Give it a moment.');
      return;
    }
    if (active.needs_code && code.trim().length === 0) {
      setStamp({ title: 'CODE NEEDED', sub: 'READ IT OFF THE MARKER' });
      setTimeout(() => setStamp(null), 2200);
      return;
    }

    setChecking(true);
    thunk();
    buzz(20);

    const { data, error } = await supabase.rpc('verify_arrival', {
      p_team: teamId, p_node: active.node_id,
      p_lat: p.lat, p_lng: p.lng, p_accuracy: p.acc,
      p_code: active.needs_code ? code.trim() : null,
    });
    setChecking(false);

    if (error) {
      setStamp({ title: 'NO SIGNAL', sub: 'TRY THAT AGAIN' });
      setTimeout(() => setStamp(null), 2200);
      return;
    }

    const r = data as ArrivalResult;
    if (r.ok) {
      setArrival(r);
      setCode('');
      void loadState();
      return;
    }

    nope();
    buzz([40, 60, 40]);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    const sub =
      r.reason === 'too_far' && r.distance_m != null ? `${r.distance_m} M OUT · KEEP WALKING`
      : r.reason === 'weak_fix' ? `ACCURACY ${Math.round(r.accuracy_m ?? 0)} M · WAIT A MOMENT`
      : r.reason === 'bad_code' ? 'THAT IS NOT THE CODE'
      : undefined;
    setStamp({
      title: r.reason === 'too_far' ? 'NOT HERE YET'
           : r.reason === 'bad_code' ? 'WRONG CODE'
           : r.reason === 'weak_fix' ? 'HOLD ON'
           : 'NO',
      sub,
    });
    setTimeout(() => setStamp(null), 2600);
  }

  // ── render ───────────────────────────────────────────────────────────────
  if (!state) {
    return (
      <main className="parchment grain relative flex min-h-dvh items-center justify-center">
        <Spinner label="Unrolling the chart" />
      </main>
    );
  }

  if (!state.ok) {
    return (
      <main className="parchment grain relative flex min-h-dvh flex-col items-center justify-center gap-5 px-8">
        <ErrorNote>{reasonText(state.reason)}</ErrorNote>
        <Link href="/" className="btn-paper push px-5 py-3 font-display text-base">BACK TO THE GATE</Link>
      </main>
    );
  }

  const { hunt, team, solved } = state;

  if (team.finished_at || (hunt.status === 'ended' && state.active.length === 0)) {
    router.replace(`/play/${teamId}/done`);
  }

  const waiting = !pos;

  return (
    <main className={`parchment grain relative flex min-h-dvh flex-col overflow-hidden ${shake ? 'anim-shake' : ''}`}>
      {/* watermark compass rose */}
      <div className="pointer-events-none absolute -left-16 top-[42%] h-[420px] w-[420px] opacity-[0.09]">
        <svg viewBox="0 0 200 200" aria-hidden>
          <g fill="none" stroke="#241a12" strokeWidth="0.7">
            <circle cx="100" cy="100" r="92" /><circle cx="100" cy="100" r="72" /><circle cx="100" cy="100" r="40" />
          </g>
          <path d="M100 8 L112 88 L100 100 L88 88 Z" fill="#241a12" />
          <path d="M100 192 L112 112 L100 100 L88 112 Z" fill="#241a12" />
          <path d="M8 100 L88 88 L100 100 L88 112 Z" fill="#241a12" />
          <path d="M192 100 L112 88 L100 100 L112 112 Z" fill="#241a12" />
        </svg>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[23px] leading-none tracking-[-0.012em]">{hunt.name}</h1>
            <MonoLabel>
              {solved} OF {hunt.total_nodes} MARKS &middot; {team.name.toUpperCase()}
            </MonoLabel>
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <ScorePlate score={team.score} />
          </div>
        </header>

        <div className="mt-4 flex items-center gap-2.5">
          <div className="flex flex-grow gap-1.5">
            {Array.from({ length: hunt.total_nodes }, (_, i) => (
              <span
                key={i}
                className="h-1.5 flex-grow rounded-full"
                style={{ background: i < solved ? '#b8332a' : 'rgba(122,103,73,0.3)' }}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-wax">
            {formatClock(remaining)}
          </span>
        </div>

        {hunt.status === 'paused' && (
          <div className="anim-rise mt-4">
            <ErrorNote>THE HUNT IS PAUSED. HOLD WHERE YOU ARE.</ErrorNote>
          </div>
        )}
        {hunt.status === 'published' && (
          <div className="anim-rise mt-4">
            <ErrorNote>NOT UNDER WAY YET. WAIT FOR THE BELL.</ErrorNote>
          </div>
        )}
        {geoError && (
          <div className="anim-rise mt-4"><ErrorNote>{geoError.toUpperCase()}</ErrorNote></div>
        )}

        {state.active.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {state.active.map((n, i) => (
              <button
                key={n.node_id}
                type="button"
                onClick={() => { tick(); setActiveIdx(i); }}
                className="push shrink-0 px-3 py-2 font-mono text-[10px] font-bold tracking-[0.12em]"
                style={
                  i === activeIdx
                    ? { background: '#b8332a', color: '#fbeeda', boxShadow: '0 3px 0 #7d1c16' }
                    : { background: 'rgba(246,236,208,0.7)', border: '2px solid #a8946c', boxShadow: '0 3px 0 #97815a' }
                }
              >
                MARK {n.seq}
                {targets[n.node_id]?.distance_m != null && ` · ${targets[n.node_id].distance_m} M`}
              </button>
            ))}
          </div>
        )}

        {active ? (
          <>
            <article
              className="parchment-flat torn relative mt-4 rotate-[-1.1deg] px-5 pb-6 pt-5"
              style={{ border: '1.5px solid #a8946c', boxShadow: '0 12px 20px rgba(45,30,14,0.26)' }}
            >
              <span className="tape absolute left-1/2 -top-[11px] h-[22px] w-[74px] -translate-x-1/2 rotate-[1.6deg]" />
              <span className="inline-block bg-wax px-2.5 pb-1.5 pt-1">
                <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-wax-ink">
                  MARK {active.seq}
                  {active.is_terminal && ' · THE LAST'}
                </span>
              </span>
              <p className="mt-3 font-body text-[21px] font-semibold leading-[1.36] text-ink" style={{ textWrap: 'pretty' }}>
                {active.clue}
              </p>
              {active.hints.some((h) => h.bought) && (
                <div className="mt-4 space-y-2 border-t border-dashed border-[#b0996d] pt-3">
                  {active.hints.filter((h) => h.bought).map((h) => (
                    <p key={h.tier} className="font-body text-[15px] font-semibold italic leading-snug text-ink-2">
                      {h.text}
                    </p>
                  ))}
                </div>
              )}
            </article>

            <div className="flex flex-1 flex-col items-center justify-center py-8">
              <Compass
                distance={target?.distance_m ?? null}
                bearing={target?.bearing_deg ?? null}
                inRange={!!target?.in_range}
                waiting={waiting}
              />
            </div>

            {active.needs_code && (
              <label className="mb-3 flex flex-col gap-1.5">
                <MonoLabel className="tracking-[0.2em]">THE CODE ON THE MARKER</MonoLabel>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 24))}
                  placeholder="e.g. ELEVEN"
                  autoCapitalize="characters"
                  className="field h-[52px] px-3.5 text-center font-display text-xl tracking-[0.12em]"
                />
              </label>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => { pageSound(); setSheet(true); }}
                className="btn-paper push mx-auto flex min-h-[46px] rotate-[0.7deg] items-center gap-2.5 px-4"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#b8332a" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
                  <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.8v.4h5.4v-.4c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3Z" />
                  <path d="M10 20h4" />
                </svg>
                <span className="font-mono text-[11px] font-bold tracking-[0.12em]">
                  CONSULT THE INFORMANT &middot; {active.hints.filter((h) => !h.bought).length} LEFT
                </span>
              </button>

              <button
                type="button"
                onClick={check}
                disabled={checking || hunt.status !== 'live'}
                className="btn-wax push relative flex min-h-[78px] items-center justify-center gap-3.5 rounded"
              >
                <span className="relative h-[46px] w-[46px] shrink-0">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'radial-gradient(circle at 34% 28%,#f6d9a8,#d8a04a 56%,#9c7328)',
                      boxShadow: 'inset 0 2px 5px rgba(255,246,214,0.6), inset 0 -3px 7px rgba(70,44,10,0.5)',
                    }}
                  />
                  <svg viewBox="0 0 46 46" className="absolute inset-0" aria-hidden>
                    <path d="M23 11 L26 20 L35 20 L28 26 L31 35 L23 29 L15 35 L18 26 L11 20 L20 20 Z"
                      fill="none" stroke="rgba(90,58,12,0.65)" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex flex-col items-start gap-0.5">
                  <span className="font-display text-[25px] leading-none tracking-[-0.01em]">
                    {checking ? 'CHECKING…' : 'MARK THIS SPOT'}
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.18em] text-[#f0bfb8]">
                    PRESS THE SEAL TO CLAIM
                  </span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="font-display text-2xl">NOTHING OPEN</p>
            <MonoLabel>WAIT FOR THE ORGANISER TO START THE HUNT</MonoLabel>
          </div>
        )}

        <nav className="mt-5 flex items-center justify-between gap-3">
          <Link
            href={`/play/${teamId}/leaderboard`}
            onClick={() => pageSound()}
            className="btn-paper push flex min-h-[44px] flex-1 items-center justify-center font-mono text-[11px] font-bold tracking-[0.14em]"
          >
            THE RECKONING
          </Link>
          {allowSim && (
            <button
              type="button"
              onClick={() => { tick(); setSimOn((v) => !v); }}
              className="push flex min-h-[44px] items-center justify-center px-3 font-mono text-[10px] font-bold tracking-[0.12em]"
              style={{ border: '2px dashed #a8946c', color: simOn ? '#b8332a' : '#7a6749' }}
            >
              {simOn ? 'SIM ON' : 'SIM'}
            </button>
          )}
        </nav>
      </div>

      {stamp && <Stamp title={stamp.title} sub={stamp.sub} />}

      {sheet && active && (
        <HintSheet
          teamId={teamId}
          node={active}
          score={team.score}
          onClose={() => setSheet(false)}
          onBought={() => void loadState()}
        />
      )}

      {arrival?.ok && (
        <ArrivalOverlay
          result={arrival}
          onDone={() => {
            setArrival(null);
            void loadState();
          }}
        />
      )}

      {allowSim && simOn && (
        <SimPanel
          pos={pos}
          target={target}
          onSet={(lat, lng) => setPos({ lat, lng, acc: 8 })}
          onClose={() => setSimOn(false)}
        />
      )}
    </main>
  );
}
