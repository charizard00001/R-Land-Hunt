'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabase/client';
import type { ControlState, Crew } from '@/lib/types';
import { reasonText } from '@/lib/types';
import { formatAgo, formatClock } from '@/lib/geo';
import { hail as hailSound, klaxon, resume as resumeSound, tick } from '@/lib/sound';
import { ChartMap, type Marker, type Trail } from '@/components/ChartMap';
import { ErrorNote, MonoLabel, Spinner } from '@/components/Chrome';

const HUES = ['#e8786e', '#8fd6a0', '#e0be5a', '#7ab0d8', '#c88ad8', '#e09a5a', '#8ad8d0', '#b8a0e8'];
const CAMPUS = { lat: 29.865, lng: 77.8966 };
const STUCK_AFTER_S = 12 * 60;

export function RaceControl({ huntId }: { huntId: string }) {
  const supabase = useMemo(() => sb(), []);
  const [state, setState] = useState<ControlState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('control_state', { p_hunt: huntId });
    if (rpcError) { setError(rpcError.message); return; }
    const s = data as ControlState;
    setState(s);
    if (s.ok) setRemaining(s.hunt.remaining_s);
  }, [supabase, huntId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const huntStatus = state?.ok ? state.hunt.status : null;

  useEffect(() => {
    if (huntStatus !== 'live') return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [huntStatus]);

  async function act(action: string) {
    if (action === 'pause') klaxon();
    else if (action === 'resume') resumeSound();
    else tick();
    const { data, error: rpcError } = await supabase.rpc('set_hunt_status', { p_hunt: huntId, p_action: action });
    if (rpcError) { setError(rpcError.message); return; }
    const r = data as { ok: boolean; reason?: string };
    if (!r.ok) { setError(reasonText(r.reason)); return; }
    setError(null);
    await load();
  }

  async function intervene(teamId: string, action: string) {
    tick();
    await supabase.rpc('intervene', { p_team: teamId, p_action: action, p_reason: 'from race control' });
    await load();
  }

  async function sendAnnounce() {
    if (!message.trim()) return;
    hailSound();
    await supabase.rpc('announce', { p_hunt: huntId, p_text: message.trim() });
    setMessage('');
    await load();
  }

  if (!state) {
    return <main className="flex min-h-dvh items-center justify-center" style={{ background: '#0c1116' }}>
      <Spinner label="Opening the room" />
    </main>;
  }
  if (!state.ok) {
    return <main className="flex min-h-dvh items-center justify-center p-8" style={{ background: '#0c1116' }}>
      <ErrorNote>{reasonText(state.reason)}</ErrorNote>
    </main>;
  }

  const { hunt, crews, alerts, feed } = state;
  const paused = hunt.status === 'paused';
  const positioned = crews.filter((c) => c.lat != null && c.lng != null);
  const centre = positioned.length
    ? { lat: positioned[0].lat!, lng: positioned[0].lng! }
    : CAMPUS;

  const hueOf = (i: number) => HUES[i % HUES.length];
  const markers: Marker[] = positioned.map((c, i) => ({
    id: c.team_id, lat: c.lat!, lng: c.lng!, kind: 'crew',
    colour: hueOf(crews.indexOf(c)), label: c.name,
  }));
  const trails: Trail[] = crews
    .filter((c) => c.trail?.length > 1)
    .map((c, i) => ({ id: c.team_id, colour: hueOf(crews.indexOf(c)), points: c.trail }));

  const stuck = crews.filter((c) => (c.idle_s ?? 0) > STUCK_AFTER_S && !c.finished);

  return (
    <main className="flex min-h-dvh flex-col" style={{ background: '#0c1116', color: '#dfe8ee' }}>
      <header
        className="leather-grain flex flex-wrap items-center justify-between gap-4 px-5 py-3"
        style={{ borderBottom: '2px solid #060a0d' }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-display text-xl tracking-[-0.015em] text-brass">RACE CONTROL</span>
          <span className="h-6 w-0.5 bg-[#2a3d4a]" />
          <span className="font-body text-[19px] font-bold text-[#eef4f8]">{hunt.name}</span>
          <span className="flex items-center gap-2 px-2.5 pb-1.5 pt-1"
            style={{ background: paused ? 'rgba(224,178,92,0.16)' : 'rgba(143,214,160,0.16)' }}>
            <span className="anim-pulse h-1.5 w-1.5 rounded-full" style={{ background: paused ? '#e0b25c' : '#8fd6a0' }} />
            <span className="font-mono text-[9px] font-bold tracking-[0.16em]" style={{ color: paused ? '#e0b25c' : '#8fd6a0' }}>
              {paused ? 'HELD' : hunt.status.toUpperCase()}
            </span>
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-[#6f8797]">
            CIPHER <span className="font-display text-[15px] text-brass">{hunt.join_code}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="font-display text-[34px] leading-none text-[#f6ecd6]">{formatClock(remaining)}</span>
            <MonoLabel className="!text-[#6f8797] tracking-[0.16em]">SERVER CLOCK</MonoLabel>
          </div>
          {hunt.status === 'live' && (
            <button type="button" onClick={() => act('pause')} className="btn-wax push px-5 py-3 font-display text-base">
              PAUSE EVERYTHING
            </button>
          )}
          {paused && (
            <button type="button" onClick={() => act('resume')} className="btn-moss push px-5 py-3 font-display text-base">
              RESUME THE HUNT
            </button>
          )}
          {(hunt.status === 'live' || paused) && (
            <button type="button" onClick={() => act('end')} className="push px-4 py-3 font-mono text-[10px] font-bold tracking-[0.12em]"
              style={{ border: '2px solid #33475a', color: '#8fa8ba' }}>
              END THE HUNT
            </button>
          )}
          <Link href={`/screen/${huntId}`} target="_blank"
            className="push px-4 py-3 font-mono text-[10px] font-bold tracking-[0.12em]"
            style={{ border: '2px solid #33475a', color: '#8fa8ba' }}>
            BIG SCREEN
          </Link>
        </div>
      </header>

      {error && <div className="px-5 pt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="flex flex-1 flex-col xl:flex-row">
        {/* crews */}
        <aside className="leather-grain shrink-0 xl:w-[290px]" style={{ borderRight: '2px solid #060a0d' }}>
          <div className="px-4 py-3" style={{ borderBottom: '2px solid #22303b' }}>
            <MonoLabel className="!text-[#6f8797] tracking-[0.22em]">
              {crews.length} CREWS AFLOAT
            </MonoLabel>
          </div>
          <ul className="max-h-[46vh] overflow-auto xl:max-h-none">
            {crews.map((c, i) => {
              const on = sel === c.team_id;
              const isStuck = (c.idle_s ?? 0) > STUCK_AFTER_S && !c.finished;
              return (
                <li key={c.team_id}>
                  <button
                    type="button"
                    onClick={() => { tick(); setSel(on ? null : c.team_id); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    style={{
                      borderBottom: '1px solid #1b2630',
                      borderLeft: `5px solid ${on ? '#e0b25c' : 'transparent'}`,
                      background: on ? 'rgba(224,178,92,0.11)' : 'transparent',
                    }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: hueOf(i), boxShadow: `0 0 9px ${hueOf(i)}` }} />
                    <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                      <span className="truncate font-body text-sm font-bold text-[#eef4f8]">{c.name}</span>
                      <span className="font-mono text-[8px] tracking-[0.1em]"
                        style={{ color: isStuck ? '#e8786e' : '#6f8797' }}>
                        {c.solved} MARKS &middot; {isStuck ? `STUCK ${Math.round((c.idle_s ?? 0) / 60)} MIN` : `SEEN ${formatAgo(c.last_seen_s).toUpperCase()}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-lg text-[#b9cbd7]">{c.score}</span>
                  </button>
                  {on && <CrewActions crew={c} onAct={(a) => intervene(c.team_id, a)} />}
                </li>
              );
            })}
            {crews.length === 0 && (
              <li className="px-4 py-8 text-center font-body text-sm italic text-[#6f8797]">
                Nobody has joined yet. Share the cipher.
              </li>
            )}
          </ul>
        </aside>

        {/* map */}
        <section className="relative min-h-[380px] flex-1" style={{ background: '#0e1f28' }}>
          <ChartMap centre={centre} spanM={1400} markers={markers} trails={trails} selectedId={sel} height={520} />

          {paused && (
            <div className="anim-rise absolute inset-x-0 top-[42%] py-5 text-center"
              style={{ background: '#b8332a', borderTop: '3px solid #f6a49a', borderBottom: '3px solid #f6a49a', boxShadow: '0 0 60px rgba(184,51,42,0.65)' }}>
              <div className="font-display text-[38px] leading-none tracking-[-0.02em] text-[#fff3ef]">HUNT PAUSED</div>
              <div className="mt-1.5 font-mono text-[10px] font-bold tracking-[0.22em] text-[#ffc9bf]">
                EVERY CLOCK IS FROZEN &middot; CREWS HAVE BEEN TOLD
              </div>
            </div>
          )}

          <div className="absolute left-4 top-4 flex flex-col gap-1 px-3.5 py-3"
            style={{ background: 'rgba(10,18,24,0.82)', border: '2px solid #2a3d4a' }}>
            <MonoLabel className="!text-[#6f8797] tracking-[0.22em]">LIVE POSITIONS</MonoLabel>
            <span className="font-display text-base text-[#f6ecd6]">{positioned.length} REPORTING</span>
            <span className="font-mono text-[9px] text-[#8fa8ba]">pings every 15 s &middot; last 24 kept</span>
          </div>

          <div className="flex flex-wrap gap-2 p-4">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendAnnounce()}
              placeholder="Message every crew — rain, regroup, ten minutes left…"
              className="field h-11 min-w-[240px] flex-grow px-3 font-body text-sm"
            />
            <button type="button" onClick={sendAnnounce} disabled={!message.trim()}
              className="btn-brass push h-11 px-5 font-display text-sm">
              HAIL ALL CREWS
            </button>
          </div>
        </section>

        {/* alerts + feed */}
        <aside className="leather-grain shrink-0 xl:w-[320px]" style={{ borderLeft: '2px solid #060a0d' }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '2px solid #22303b' }}>
            <MonoLabel className="!text-[#6f8797] tracking-[0.22em]">WANTS YOUR ATTENTION</MonoLabel>
            <span className="px-2 pb-0.5 pt-0.5 font-display text-[13px]"
              style={{ background: '#b8332a', color: '#fff3ef' }}>
              {alerts.length + stuck.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 p-3.5">
            {stuck.map((c) => (
              <AlertCard
                key={`stuck-${c.team_id}`}
                edge="#e0b25c"
                kind="STUCK CREW"
                ago={`${Math.round((c.idle_s ?? 0) / 60)} min`}
                body={`${c.name} has not cleared a mark in ${Math.round((c.idle_s ?? 0) / 60)} minutes.`}
                cta="GIFT A HINT"
                onAct={() => intervene(c.team_id, 'free_hint')}
              />
            ))}
            {alerts.map((a, i) => (
              <AlertCard
                key={`flag-${i}`}
                edge="#e05a4c"
                kind={a.kind}
                ago={formatAgo(a.ago_s)}
                body={`${a.team}: ${a.body}`}
                cta="LET IT STAND"
                onAct={() => tick()}
              />
            ))}
            {alerts.length + stuck.length === 0 && (
              <p className="py-6 text-center font-body text-sm italic text-[#6f8797]">
                Nothing needs you. Enjoy it while it lasts.
              </p>
            )}
          </div>

          <div className="px-4 py-3" style={{ borderTop: '2px solid #22303b', borderBottom: '2px solid #22303b' }}>
            <MonoLabel className="!text-[#6f8797] tracking-[0.22em]">THE LOG</MonoLabel>
          </div>
          <ul className="max-h-[40vh] overflow-auto">
            {feed.map((f, i) => (
              <li key={i} className="flex gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid #1b2630' }}>
                <span className="shrink-0 font-mono text-[9px] tracking-[0.06em] text-[#5f7686]">
                  {formatAgo(f.ago_s)}
                </span>
                <span className="font-body text-[13px] leading-snug text-[#8fa8ba]">
                  {f.kind === 'arrival_ok' && <><b className="text-[#eef4f8]">{f.team}</b> cleared <b className="text-brass">{f.label}</b>{f.points && ` +${f.points}`}</>}
                  {f.kind === 'hint' && <><b className="text-[#eef4f8]">{f.team}</b> bought a hint</>}
                  {f.kind === 'finish' && <><b className="text-[#8fd6a0]">{f.team}</b> came home</>}
                  {f.kind === 'flag' && <><b className="text-[#e8786e]">{f.team}</b> raised a flag</>}
                  {f.kind === 'announce' && <i>you hailed the crews</i>}
                  {f.kind === 'clock' && <i>the clock changed</i>}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}

function CrewActions({ crew, onAct }: { crew: Crew; onAct: (a: string) => void }) {
  return (
    <div className="flex gap-2 px-4 pb-3" style={{ borderBottom: '1px solid #1b2630' }}>
      <button type="button" onClick={() => onAct('free_hint')}
        className="push flex-1 px-2.5 py-2 font-mono text-[9px] font-bold tracking-[0.08em]"
        style={{ border: '2px solid #33475a', color: '#8fa8ba' }}>
        FREE HINT
      </button>
      <button type="button" onClick={() => onAct('force_unlock')}
        className="push flex-1 px-2.5 py-2 font-mono text-[9px] font-bold tracking-[0.08em]"
        style={{ border: '2px solid #8a6a2c', color: '#e0b25c' }}>
        LET THEM PASS
      </button>
      {crew.finished && (
        <span className="px-2.5 py-2 font-mono text-[9px] font-bold tracking-[0.08em] text-[#8fd6a0]">HOME</span>
      )}
    </div>
  );
}

function AlertCard({
  edge, kind, ago, body, cta, onAct,
}: { edge: string; kind: string; ago: string; body: string; cta: string; onAct: () => void }) {
  return (
    <div className="flex flex-col gap-2 px-3.5 py-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: `2px solid ${edge}`, borderLeft: `6px solid ${edge}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] font-bold tracking-[0.16em]" style={{ color: edge }}>{kind}</span>
        <span className="font-mono text-[8px] text-[#5f7686]">{ago}</span>
      </div>
      <p className="font-body text-[13px] font-semibold leading-snug text-[#eef4f8]">{body}</p>
      <button type="button" onClick={onAct}
        className="push self-start px-2.5 py-1.5 font-mono text-[9px] font-bold tracking-[0.08em]"
        style={{ border: '2px solid #33475a', color: '#8fa8ba' }}>
        {cta}
      </button>
    </div>
  );
}
