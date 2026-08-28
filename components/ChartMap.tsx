'use client';

import { useMemo, useRef } from 'react';

/**
 * A schematic chart drawn in SVG.
 *
 * Deliberately not a tile map: the OSM Foundation's tile servers are not for
 * production apps and forbid area caching, and every keyed provider is one more
 * account to hold. This projects lat/lng locally, costs nothing, works offline,
 * and draws geofence circles at TRUE metric scale so what an organiser sees is
 * the fence the database will actually enforce.
 */

export type Marker = {
  id: string;
  lat: number;
  lng: number;
  radius_m?: number;
  label?: string;
  colour?: string;
  kind?: 'node' | 'crew' | 'you';
};

export type Trail = { id: string; colour: string; points: { lat: number; lng: number }[] };

const M_PER_DEG_LAT = 111_320;

export function ChartMap({
  centre,
  spanM = 900,
  markers = [],
  trails = [],
  onPick,
  selectedId,
  className = '',
  height = 320,
}: {
  centre: { lat: number; lng: number };
  spanM?: number;
  markers?: Marker[];
  trails?: Trail[];
  onPick?: (lat: number, lng: number) => void;
  selectedId?: string | null;
  className?: string;
  height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const SIZE = 1000; // viewBox units; the SVG scales to its container
  const perM = SIZE / spanM;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((centre.lat * Math.PI) / 180);

  const project = useMemo(
    () => (lat: number, lng: number) => ({
      x: SIZE / 2 + (lng - centre.lng) * mPerDegLng * perM,
      y: SIZE / 2 - (lat - centre.lat) * M_PER_DEG_LAT * perM,
    }),
    [centre.lat, centre.lng, mPerDegLng, perM]
  );

  function unproject(x: number, y: number) {
    return {
      lat: centre.lat - (y - SIZE / 2) / perM / M_PER_DEG_LAT,
      lng: centre.lng + (x - SIZE / 2) / perM / mPerDegLng,
    };
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onPick || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const { lat, lng } = unproject(x, y);
    onPick(lat, lng);
  }

  // A 100 m grid keeps scale readable without pretending to be a real map.
  const gridStep = perM * 100;
  const lines: number[] = [];
  for (let v = (SIZE / 2) % gridStep; v < SIZE; v += gridStep) lines.push(v);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ height, width: '100%', cursor: onPick ? 'crosshair' : 'default', display: 'block' }}
      onClick={handleClick}
      role="img"
      aria-label="Schematic chart of the hunt area"
    >
      <rect width={SIZE} height={SIZE} fill="#16261f" />
      <g stroke="rgba(224,178,92,0.14)" strokeWidth={1.5} fill="none">
        {lines.map((v) => (
          <line key={`h${v}`} x1={0} y1={v} x2={SIZE} y2={v} />
        ))}
        {lines.map((v) => (
          <line key={`v${v}`} x1={v} y1={0} x2={v} y2={SIZE} />
        ))}
      </g>

      {trails.map((t) => {
        const pts = t.points.map((p) => project(p.lat, p.lng));
        if (pts.length < 2) return null;
        return (
          <polyline
            key={t.id}
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={t.colour}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.75}
          />
        );
      })}

      {markers.map((m) => {
        const p = project(m.lat, m.lng);
        const colour = m.colour ?? '#e0b25c';
        const on = selectedId === m.id;
        return (
          <g key={m.id}>
            {m.radius_m ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={Math.max(4, m.radius_m * perM)}
                fill={on ? 'rgba(184,51,42,0.22)' : 'rgba(224,178,92,0.16)'}
                stroke={on ? '#e05a4c' : colour}
                strokeWidth={on ? 4 : 3}
                strokeDasharray="10 8"
              />
            ) : null}
            {m.kind === 'crew' ? (
              <>
                <circle cx={p.x} cy={p.y} r={22} fill={colour} opacity={0.25} />
                <circle cx={p.x} cy={p.y} r={11} fill={colour} stroke="#0c1116" strokeWidth={3} />
              </>
            ) : (
              <circle
                cx={p.x}
                cy={p.y}
                r={on ? 13 : 10}
                fill={on ? '#e05a4c' : colour}
                stroke="#241a12"
                strokeWidth={3}
              />
            )}
            {m.label && (
              <text
                x={p.x + 18}
                y={p.y + 5}
                fill="#f0e4c6"
                fontSize={26}
                fontFamily="var(--font-mono), monospace"
                style={{ paintOrder: 'stroke', stroke: '#16261f', strokeWidth: 6 }}
              >
                {m.label}
              </text>
            )}
          </g>
        );
      })}

      {/* scale bar */}
      <g>
        <line x1={40} y1={SIZE - 40} x2={40 + perM * 100} y2={SIZE - 40} stroke="#e0b25c" strokeWidth={5} />
        <text x={40} y={SIZE - 54} fill="#e0b25c" fontSize={24} fontFamily="var(--font-mono), monospace">
          100 m
        </text>
      </g>
    </svg>
  );
}
