'use client';

import { compassLabel, formatDistance } from '@/lib/geo';

/**
 * The brass compass. The ring lies on a tilted plane (a real rotateX, not a
 * painted ellipse) and the readout floats flat above it so it stays crisp.
 *
 * The needle points at a bearing the SERVER computed. The device is never told
 * where the target is.
 */
export function Compass({
  distance,
  bearing,
  inRange,
  waiting,
}: {
  distance: number | null;
  bearing: number | null;
  inRange: boolean;
  waiting: boolean;
}) {
  const d = distance == null ? null : formatDistance(distance);

  return (
    <div className="relative h-[214px] w-[214px]" style={{ perspective: 720 }}>
      <div className="absolute inset-0" style={{ transform: 'rotateX(24deg)', transformStyle: 'preserve-3d' }}>
        <div
          className="absolute inset-2 rounded-full"
          style={{
            background: 'radial-gradient(circle at 34% 26%, #f4eaca, #d3c096 58%, #b09a6e)',
            boxShadow: '0 18px 26px rgba(40,26,12,0.38), inset 0 0 22px rgba(120,92,48,0.35)',
          }}
        />
        <svg viewBox="0 0 214 214" width={214} height={214} className="absolute inset-0" aria-hidden>
          <circle cx="107" cy="107" r="95" fill="none" stroke="#6a4e18" strokeWidth="8" />
          <circle cx="107" cy="107" r="95" fill="none" stroke="#deae5e" strokeWidth="5" />
          {/* 36 minor ticks, then 4 cardinals, drawn with dash arrays */}
          <circle cx="107" cy="107" r="84" fill="none" stroke="#6d5426" strokeWidth="6" strokeDasharray="2 12.65" />
          <circle cx="107" cy="107" r="84" fill="none" stroke="#6d5426" strokeWidth="12" strokeDasharray="3 128.9" />
        </svg>

        {bearing != null && (
          <div
            className="anim-sway absolute left-1/2 top-[26px] -ml-px h-[88px] w-0.5"
            style={{ ['--bearing' as string]: `${bearing}deg`, transform: `rotate(${bearing}deg)` }}
          >
            <svg viewBox="0 0 20 100" width={20} height={100} className="absolute -left-[9px] top-0" aria-hidden>
              <path d="M10 0 L18 74 L10 82 L2 74 Z" fill={inRange ? '#2f5d3a' : '#b8332a'} />
              <path d="M10 82 L15 96 L10 100 L5 96 Z" fill="#3a2c18" />
            </svg>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 top-[66px] flex flex-col items-center gap-0.5">
        {waiting || d == null ? (
          <>
            <div className="font-display text-[34px] leading-none text-ink-3">— —</div>
            <div className="font-mono text-[9px] font-bold tracking-[0.3em] text-ink-3">
              FINDING YOU
            </div>
          </>
        ) : (
          <>
            <div
              className="font-display leading-[0.84]"
              style={{
                fontSize: d.value.length > 3 ? 46 : 62,
                textShadow: '0 2px 0 rgba(255,248,224,0.7)',
                color: inRange ? '#2f5d3a' : '#241a12',
              }}
            >
              {d.value}
            </div>
            <div className="font-mono text-[9px] font-bold tracking-[0.34em] text-[#6b5738]">
              {inRange ? 'YOU ARE HERE' : d.unit}
            </div>
          </>
        )}
      </div>

      {bearing != null && !inRange && (
        <div className="absolute inset-x-0 -bottom-7 text-center font-mono text-[11px] tracking-[0.2em] text-ink-2">
          BEARING {String(Math.round(bearing)).padStart(3, '0')}&deg; &middot;{' '}
          {compassLabel(bearing).toUpperCase()}
        </div>
      )}
    </div>
  );
}
