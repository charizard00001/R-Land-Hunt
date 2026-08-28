'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabase/client';
import type { EdgeRow, HuntRow, NodeRow, ProofPolicy } from '@/lib/types';
import { reasonText } from '@/lib/types';
import { pin, stamp as stampSound, thunk, tick } from '@/lib/sound';
import { ChartMap, type Marker } from '@/components/ChartMap';
import { ErrorNote, MonoLabel, Spinner } from '@/components/Chrome';

const KIND_TONE: Record<string, { bg: string; ink: string; pin: string }> = {
  riddle: { bg: '#b8332a', ink: '#fbeeda', pin: 'radial-gradient(circle at 34% 28%,#f6a49a,#96231d)' },
  cipher: { bg: '#8a6a2c', ink: '#ffeec6', pin: 'radial-gradient(circle at 34% 28%,#f8d89a,#8a6a2c)' },
  photo: { bg: '#5a2f7f', ink: '#f0e4ff', pin: 'radial-gradient(circle at 34% 28%,#e2c8f8,#5a2f7f)' },
  gate: { bg: '#24507f', ink: '#e2f0ff', pin: 'radial-gradient(circle at 34% 28%,#b8d8f8,#24507f)' },
  finish: { bg: '#2f5d3a', ink: '#eaf6ec', pin: 'radial-gradient(circle at 34% 28%,#a8e8b8,#2f5d3a)' },
};

const PROOFS: { id: ProofPolicy; label: string; dot: string }[] = [
  { id: 'gps', label: 'GPS ONLY', dot: '#7a9ab0' },
  { id: 'gps_code', label: 'GPS + CODE', dot: '#e0b25c' },
  { id: 'gps_photo', label: 'GPS + PHOTO', dot: '#e05a4c' },
  { id: 'qr', label: 'QR FALLBACK', dot: '#8fd6a0' },
];

const CAMPUS = { lat: 29.865, lng: 77.8966 };

export function StudioEditor({ huntId }: { huntId: string }) {
  const supabase = useMemo(() => sb(), []);
  const [hunt, setHunt] = useState<HuntRow | null>(null);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: h }, { data: n }, { data: e }] = await Promise.all([
      supabase.from('hunts').select('*').eq('id', huntId).single(),
      supabase.from('nodes').select('*').eq('hunt_id', huntId).order('seq'),
      supabase.from('edges').select('*').eq('hunt_id', huntId),
    ]);
    setHunt(h as HuntRow);
    const list = (n as NodeRow[]) ?? [];
    setNodes(list);
    setEdges((e as EdgeRow[]) ?? []);
    setSelId((cur) => cur ?? list[0]?.id ?? null);
  }, [supabase, huntId]);

  useEffect(() => { void load(); }, [load]);

  const sel = nodes.find((n) => n.id === selId) ?? null;
  const centre = sel?.lat != null && sel?.lng != null ? { lat: sel.lat, lng: sel.lng } : CAMPUS;

  async function patch(id: string, fields: Partial<NodeRow>) {
    setSaving(true);
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...fields } : n)));
    const { error: upError } = await supabase.from('nodes').update(fields).eq('id', id);
    setSaving(false);
    if (upError) setError(upError.message);
  }

  async function addNode(kind: string) {
    pin();
    const seq = (nodes.at(-1)?.seq ?? 0) + 1;
    const { data, error: insError } = await supabase
      .from('nodes')
      .insert({
        hunt_id: huntId,
        label: `Mark ${seq}`,
        kind,
        clue: '',
        hints: [],
        seq,
        is_start: nodes.length === 0,
        is_terminal: kind === 'finish',
        lat: CAMPUS.lat,
        lng: CAMPUS.lng,
      })
      .select()
      .single();
    if (insError) { setError(insError.message); return; }
    const created = data as NodeRow;
    // Chain it after the last mark so a simple linear hunt needs no wiring.
    const prev = nodes.at(-1);
    if (prev) {
      await supabase.from('edges').insert({
        hunt_id: huntId, from_node: prev.id, to_node: created.id, unlock_rule: { type: 'all' },
      });
    }
    await load();
    setSelId(created.id);
  }

  async function removeNode(id: string) {
    thunk();
    await supabase.from('nodes').delete().eq('id', id);
    setSelId(null);
    await load();
  }

  async function addEdge(to: string) {
    if (!sel) return;
    tick();
    await supabase.from('edges').insert({
      hunt_id: huntId, from_node: sel.id, to_node: to, unlock_rule: { type: 'all' },
    });
    await load();
  }

  async function removeEdge(from: string, to: string) {
    tick();
    await supabase.from('edges').delete().eq('from_node', from).eq('to_node', to);
    await load();
  }

  async function act(action: string) {
    stampSound();
    const { data, error: rpcError } = await supabase.rpc('set_hunt_status', {
      p_hunt: huntId, p_action: action,
    });
    if (rpcError) { setError(rpcError.message); return; }
    const r = data as { ok: boolean; reason?: string };
    if (!r.ok) { setError(reasonText(r.reason)); return; }
    setError(null);
    await load();
  }

  if (!hunt) {
    return <main className="flex min-h-dvh items-center justify-center" style={{ background: '#17120d' }}>
      <Spinner label="Unpinning the board" />
    </main>;
  }

  const outgoing = edges.filter((e) => e.from_node === sel?.id);
  const warnings = [
    !nodes.some((n) => n.is_start) && 'No opening mark set.',
    nodes.some((n) => n.lat == null) && 'A mark has no location.',
    !nodes.some((n) => n.is_terminal) && 'No final mark set.',
    nodes.some((n) => !n.clue.trim()) && 'A mark has no clue written.',
  ].filter(Boolean) as string[];

  const mapMarkers: Marker[] = nodes
    .filter((n) => n.lat != null && n.lng != null)
    .map((n) => ({
      id: n.id, lat: n.lat!, lng: n.lng!, radius_m: n.radius_m,
      label: String(n.seq), colour: KIND_TONE[n.kind]?.bg ?? '#e0b25c',
    }));

  return (
    <main className="flex min-h-dvh flex-col" style={{ background: '#17120d' }}>
      <header
        className="leather-grain flex flex-wrap items-center justify-between gap-4 px-5 py-3"
        style={{ borderBottom: '2px solid #0d0906' }}
      >
        <div className="flex items-center gap-4">
          <Link href="/studio" className="font-mono text-[10px] tracking-[0.14em] text-[#a08a63] underline">
            ALL CHARTS
          </Link>
          <span className="h-6 w-0.5 bg-[#3d2f20]" />
          <span className="font-body text-[19px] font-bold text-[#f0e2bd]">{hunt.name}</span>
          <span className="px-2.5 pb-1 pt-0.5 font-mono text-[9px] font-bold tracking-[0.16em]"
            style={{ background: '#8a6a2c', color: '#ffeec6' }}>
            {hunt.status.toUpperCase()}
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-[#a08a63]">
            CIPHER <span className="font-display text-[15px] text-[#e0b25c]">{hunt.join_code}</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {saving && <MonoLabel className="!text-[#8a7148]">SAVING…</MonoLabel>}
          {hunt.status === 'draft' && (
            <button type="button" onClick={() => act('publish')} className="btn-brass push px-5 py-2.5 font-display text-[15px]">
              SEAL &amp; PUBLISH
            </button>
          )}
          {hunt.status === 'published' && (
            <>
              <button type="button" onClick={() => act('unpublish')} className="push px-4 py-2.5 font-mono text-[10px] font-bold tracking-[0.12em]"
                style={{ border: '2px solid #4a3826', color: '#c8b48c' }}>
                BACK TO DRAFT
              </button>
              <button type="button" onClick={() => act('start')} className="btn-moss push px-5 py-2.5 font-display text-[15px]">
                START THE HUNT
              </button>
            </>
          )}
          {(hunt.status === 'live' || hunt.status === 'paused') && (
            <Link href={`/control/${huntId}`} className="btn-wax push px-5 py-2.5 font-display text-[15px]">
              RACE CONTROL
            </Link>
          )}
        </div>
      </header>

      {error && <div className="px-5 pt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── palette ── */}
        <aside
          className="leather-grain flex shrink-0 flex-col gap-5 p-4 lg:w-[228px]"
          style={{ borderRight: '2px solid #0d0906' }}
        >
          <div className="flex flex-col gap-2.5">
            <MonoLabel className="!text-[#8a7148] tracking-[0.22em]">PIN A NEW MARK</MonoLabel>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {(['riddle', 'cipher', 'photo', 'gate', 'finish'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => addNode(k)}
                  className="push flex items-center gap-2.5 px-3 py-2.5 text-left"
                  style={{ border: '2px dashed #4a3826', color: '#d8c8a2' }}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_TONE[k].bg }} />
                  <span className="font-mono text-[10px] font-bold tracking-[0.08em]">{k.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <MonoLabel className="!text-[#8a7148] tracking-[0.22em]">THE CHART SO FAR</MonoLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: nodes.length, l: 'MARKS', c: '#e0b25c' },
                { v: edges.length, l: 'LINKS', c: '#8fd6a0' },
              ].map((s) => (
                <div key={s.l} className="px-3 py-2.5" style={{ background: 'rgba(224,178,92,0.1)', border: '1px solid #4a3826' }}>
                  <div className="font-display text-[22px] leading-none" style={{ color: s.c }}>{s.v}</div>
                  <div className="font-mono text-[8px] tracking-[0.12em] text-[#a08a63]">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="mt-auto px-3.5 py-3" style={{ background: '#b8332a', boxShadow: '0 4px 0 #7d1c16' }}>
              {warnings.map((w) => (
                <div key={w} className="font-mono text-[9px] font-bold leading-relaxed tracking-[0.06em] text-[#fbeeda]">
                  {w.toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── the board ── */}
        <section className="cork-board relative min-h-[420px] flex-1 overflow-auto p-6"
          style={{ boxShadow: 'inset 0 0 60px rgba(60,30,10,0.5)' }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {edges.map((e) => {
              const a = nodes.findIndex((n) => n.id === e.from_node);
              const b = nodes.findIndex((n) => n.id === e.to_node);
              if (a < 0 || b < 0) return null;
              const ax = 118 + (a % 3) * 208, ay = 74 + Math.floor(a / 3) * 168;
              const bx = 118 + (b % 3) * 208, by = 74 + Math.floor(b / 3) * 168;
              return (
                <path
                  key={`${e.from_node}-${e.to_node}`}
                  d={`M${ax} ${ay} C ${(ax + bx) / 2} ${ay}, ${(ax + bx) / 2} ${by}, ${bx} ${by}`}
                  fill="none" stroke="#8d2a22" strokeWidth="3.4" strokeLinecap="round" opacity="0.95"
                />
              );
            })}
          </svg>

          <div className="relative grid gap-x-9 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
            {nodes.map((n) => {
              const tone = KIND_TONE[n.kind] ?? KIND_TONE.riddle;
              const on = n.id === selId;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { pin(); setSelId(n.id); }}
                  className="push relative px-3.5 pb-3.5 pt-3.5 text-left"
                  style={{
                    background: on ? 'linear-gradient(#fdf6e2,#f2e6c6)' : 'linear-gradient(#f4ecd4,#e5d8b6)',
                    border: '2px solid #a8946c',
                    boxShadow: on
                      ? '0 18px 32px rgba(40,18,6,0.55), 0 0 0 3px #b8332a'
                      : '0 6px 0 #8d7a56, 0 10px 18px rgba(40,18,6,0.34)',
                    transform: `rotate(${((n.seq % 5) - 2) * 0.9}deg)${on ? ' scale(1.04)' : ''}`,
                  }}
                >
                  <span
                    className="absolute left-1/2 -top-2.5 h-[19px] w-[19px] -translate-x-1/2 rounded-full"
                    style={{ background: tone.pin, boxShadow: '0 3px 5px rgba(40,16,6,0.6), inset 0 2px 3px rgba(255,255,255,0.5)' }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-1.5 pb-1 pt-0.5 font-mono text-[8px] font-bold tracking-[0.14em]"
                      style={{ background: tone.bg, color: tone.ink }}>
                      {n.kind.toUpperCase()}
                    </span>
                    <span className="font-mono text-[8px] tracking-[0.1em] text-ink-3">{n.base_points} PTS</span>
                  </div>
                  <div className="mt-2 font-display text-[15px] leading-tight tracking-[-0.012em]">{n.label}</div>
                  <p className="mt-1.5 line-clamp-2 font-body text-[13px] font-medium italic leading-snug text-ink-3">
                    {n.clue || 'no clue written yet'}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {n.is_start && <Flag>OPENS</Flag>}
                    {n.is_terminal && <Flag>FINAL</Flag>}
                    {n.lat == null && <Flag danger>NO PIN</Flag>}
                  </div>
                </button>
              );
            })}
          </div>

          {nodes.length === 0 && (
            <p className="mt-16 text-center font-body text-[15px] italic text-[#3a2410]">
              An empty board. Pin your first mark from the rail on the left.
            </p>
          )}
        </section>

        {/* ── node editor ── */}
        <aside
          className="leather-grain flex shrink-0 flex-col lg:w-[380px]"
          style={{ borderLeft: '2px solid #0d0906' }}
        >
          {!sel ? (
            <p className="p-6 font-body text-[15px] italic text-[#8a7148]">Pick a mark to edit it.</p>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={sel.label}
                  onChange={(e) => patch(sel.id, { label: e.target.value })}
                  className="field h-11 flex-grow px-3 font-display text-[17px]"
                />
                <button
                  type="button"
                  onClick={() => removeNode(sel.id)}
                  className="push shrink-0 px-3 py-2.5 font-mono text-[9px] font-bold tracking-[0.1em]"
                  style={{ border: '2px solid #6a120e', color: '#e8786e' }}
                >
                  REMOVE
                </button>
              </div>

              <Field label="THE CLUE AS WRITTEN">
                <textarea
                  value={sel.clue}
                  onChange={(e) => patch(sel.id, { clue: e.target.value })}
                  rows={4}
                  placeholder="Where the iron bird has kept her watch…"
                  className="field w-full resize-y px-3.5 py-3 font-body text-[15px] font-semibold leading-snug"
                />
              </Field>

              <Field label="WHERE IT SITS — CLICK THE CHART">
                <div style={{ border: '2px solid #3d2f20' }}>
                  <ChartMap
                    centre={centre}
                    spanM={600}
                    markers={mapMarkers}
                    selectedId={sel.id}
                    height={200}
                    onPick={(lat, lng) => { tick(); patch(sel.id, { lat, lng }); }}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={sel.lat?.toFixed(5) ?? ''}
                    onChange={(e) => patch(sel.id, { lat: Number(e.target.value) })}
                    className="field h-10 w-full px-2 text-center font-mono text-[12px]"
                    aria-label="Latitude"
                  />
                  <input
                    value={sel.lng?.toFixed(5) ?? ''}
                    onChange={(e) => patch(sel.id, { lng: Number(e.target.value) })}
                    className="field h-10 w-full px-2 text-center font-mono text-[12px]"
                    aria-label="Longitude"
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <MonoLabel className="!text-[#a08a63] tracking-[0.12em]">RADIUS</MonoLabel>
                  <input
                    type="range" min={5} max={200} step={5} value={sel.radius_m}
                    onChange={(e) => patch(sel.id, { radius_m: Number(e.target.value) })}
                    className="flex-grow accent-[#e0b25c]"
                  />
                  <span className="w-14 text-right font-display text-base text-[#f6ecd6]">{sel.radius_m} m</span>
                </div>
              </Field>

              <Field label="HOW THEY MUST PROVE IT">
                <div className="grid grid-cols-2 gap-2">
                  {PROOFS.map((p) => {
                    const on = sel.proof === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { tick(); patch(sel.id, { proof: p.id }); }}
                        className="push flex items-center gap-2 px-3 py-2.5"
                        style={{
                          border: `2px solid ${on ? '#e0b25c' : '#4a3826'}`,
                          background: on ? 'rgba(224,178,92,0.18)' : 'transparent',
                          color: on ? '#f6ecd6' : '#8a7351',
                        }}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.dot }} />
                        <span className="font-mono text-[9px] font-bold tracking-[0.06em]">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
                {(sel.proof === 'gps_code' || sel.proof === 'qr') && (
                  <input
                    value={sel.site_code ?? ''}
                    onChange={(e) => patch(sel.id, { site_code: e.target.value.toUpperCase() })}
                    placeholder="THE CODE ON THE MARKER"
                    className="field mt-2 h-11 w-full px-3 text-center font-display text-base tracking-[0.1em]"
                  />
                )}
              </Field>

              <Field label="THE INFORMANT SELLS">
                <div className="flex flex-col gap-2">
                  {sel.hints.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={h.text}
                        onChange={(e) => {
                          const next = sel.hints.map((x, j) => (j === i ? { ...x, text: e.target.value } : x));
                          patch(sel.id, { hints: next });
                        }}
                        className="field h-10 flex-grow px-2.5 font-body text-[13px]"
                      />
                      <input
                        type="number" min={0} max={500} value={h.cost}
                        onChange={(e) => {
                          const next = sel.hints.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x));
                          patch(sel.id, { hints: next });
                        }}
                        className="field h-10 w-16 px-2 text-center font-mono text-[12px]"
                        aria-label="Hint cost"
                      />
                      <button
                        type="button"
                        onClick={() => patch(sel.id, { hints: sel.hints.filter((_, j) => j !== i) })}
                        className="push h-10 w-9 shrink-0 font-mono text-[12px]"
                        style={{ border: '2px solid #6a120e', color: '#e8786e' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => patch(sel.id, {
                      hints: [...sel.hints, { cost: [10, 30, 60, 150][sel.hints.length] ?? 100, text: '' }],
                    })}
                    className="push px-3 py-2.5 font-mono text-[10px] font-bold tracking-[0.1em]"
                    style={{ border: '2px dashed #4a3826', color: '#c8b48c' }}
                  >
                    + ADD A RUNG
                  </button>
                </div>
              </Field>

              <Field label="WHAT IT OPENS">
                <div className="flex flex-col gap-2">
                  {outgoing.map((e) => {
                    const to = nodes.find((n) => n.id === e.to_node);
                    return (
                      <div key={e.to_node} className="flex items-center gap-2">
                        <span className="flex-grow font-mono text-[11px] text-[#d8c8a2]">→ {to?.label ?? '?'}</span>
                        <button
                          type="button"
                          onClick={() => removeEdge(sel.id, e.to_node)}
                          className="push px-2 py-1.5 font-mono text-[9px]"
                          style={{ border: '2px solid #6a120e', color: '#e8786e' }}
                        >
                          UNLINK
                        </button>
                      </div>
                    );
                  })}
                  <select
                    value=""
                    onChange={(e) => e.target.value && addEdge(e.target.value)}
                    className="field h-10 w-full px-2 font-mono text-[11px]"
                  >
                    <option value="">link to another mark…</option>
                    {nodes
                      .filter((n) => n.id !== sel.id && !outgoing.some((e) => e.to_node === n.id))
                      .map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Toggle on={sel.is_start} onClick={() => patch(sel.id, { is_start: !sel.is_start })}>
                  OPENING MARK
                </Toggle>
                <Toggle on={sel.is_terminal} onClick={() => patch(sel.id, { is_terminal: !sel.is_terminal })}>
                  FINAL MARK
                </Toggle>
              </div>

              <Field label="POINTS FOR REACHING IT">
                <input
                  type="number" min={0} max={1000} step={10} value={sel.base_points}
                  onChange={(e) => patch(sel.id, { base_points: Number(e.target.value) })}
                  className="field h-11 w-full px-3 text-center font-display text-lg"
                />
              </Field>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <MonoLabel className="!text-[#8a7148] tracking-[0.2em]">{label}</MonoLabel>
      {children}
    </div>
  );
}

function Flag({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className="px-1.5 pb-0.5 pt-0.5 font-mono text-[8px] font-bold tracking-[0.1em]"
      style={{ background: danger ? '#b8332a' : '#4a3826', color: danger ? '#fbeeda' : '#d8c8a2' }}
    >
      {children}
    </span>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => { tick(); onClick(); }}
      className="push px-3 py-2.5 font-mono text-[9px] font-bold tracking-[0.1em]"
      style={{
        border: `2px solid ${on ? '#e0b25c' : '#4a3826'}`,
        background: on ? 'rgba(224,178,92,0.18)' : 'transparent',
        color: on ? '#f6ecd6' : '#8a7351',
      }}
    >
      {children}
    </button>
  );
}
