'use client';

import { useState } from 'react';
import type { Target } from '@/lib/types';
import { tick } from '@/lib/sound';
import { MonoLabel } from '@/components/Chrome';

const M_PER_DEG_LAT = 111_320;

/**
 * Dev-only position simulator.
 *
 * Walking a hunt to test it is the single worst part of building one, so the
 * organiser can fake a position here. It is gated behind NEXT_PUBLIC_ALLOW_SIM
 * and changes nothing server-side: the database still runs the same geofence
 * against whatever coordinates arrive.
 */
export function SimPanel({
  pos,
  target,
  onSet,
  onClose,
}: {
  pos: { lat: number; lng: number } | null;
  target: Target | null;
  onSet: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const [lat, setLat] = useState(pos ? pos.lat.toFixed(5) : '29.86500');
  const [lng, setLng] = useState(pos ? pos.lng.toFixed(5) : '77.89660');

  function apply() {
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) { tick(); onSet(la, ln); }
  }

  /** Step toward the mark using the bearing the server already gave us. */
  function step(metres: number) {
    if (!pos || !target || target.bearing_deg == null || target.distance_m == null) return;
    const go = Math.min(metres, target.distance_m);
    const rad = (target.bearing_deg * Math.PI) / 180;
    const dLat = (go * Math.cos(rad)) / M_PER_DEG_LAT;
    const dLng = (go * Math.sin(rad)) / (M_PER_DEG_LAT * Math.cos((pos.lat * Math.PI) / 180));
    const nLat = pos.lat + dLat;
    const nLng = pos.lng + dLng;
    setLat(nLat.toFixed(5));
    setLng(nLng.toFixed(5));
    tick();
    onSet(nLat, nLng);
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md p-3.5"
      style={{ background: '#241708', border: '2px dashed #8a6a2c', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <MonoLabel className="tracking-[0.2em] !text-[#e0b25c]">POSITION SIMULATOR &middot; DEV</MonoLabel>
        <button type="button" onClick={onClose} className="font-mono text-[10px] tracking-[0.14em] text-[#a08a63] underline">
          CLOSE
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          inputMode="decimal"
          aria-label="Latitude"
          className="field h-11 w-full px-2 text-center font-mono text-[13px]"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          inputMode="decimal"
          aria-label="Longitude"
          className="field h-11 w-full px-2 text-center font-mono text-[13px]"
        />
        <button type="button" onClick={apply} className="btn-brass push h-11 shrink-0 px-3 font-display text-sm">
          SET
        </button>
      </div>

      <div className="mt-2.5 flex gap-2">
        {[25, 100, 500].map((m) => (
          <button
            key={m}
            type="button"
            disabled={!target || target.bearing_deg == null}
            onClick={() => step(m)}
            className="push h-10 flex-1 font-mono text-[10px] font-bold tracking-[0.1em] disabled:opacity-40"
            style={{ border: '2px solid #4a3826', color: '#c8b48c' }}
          >
            +{m} M TOWARD
          </button>
        ))}
      </div>

      <p className="mt-2.5 font-mono text-[9px] leading-relaxed tracking-[0.08em] text-[#8a7148]">
        {target?.distance_m != null
          ? `${target.distance_m} m to the open mark${target.in_range ? ' · INSIDE THE FENCE' : ''}`
          : 'No open mark to walk toward.'}
      </p>
    </aside>
  );
}
