'use client';

import { useEffect, useState } from 'react';
import { setSound, soundOn, tick } from '@/lib/sound';

export function Rule({ children }: { children?: React.ReactNode }) {
  const dash = 'repeating-linear-gradient(90deg,#8a7351 0 7px,transparent 7px 12px)';
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-0.5 flex-grow" style={{ background: dash }} />
      {children && (
        <div className="font-mono text-[11px] font-bold tracking-[0.16em] text-wax">{children}</div>
      )}
      <div className="h-0.5 flex-grow" style={{ background: dash }} />
    </div>
  );
}

export function MonoLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10px] tracking-[0.17em] text-ink-3 ${className}`}>{children}</span>
  );
}

export function WaxTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-wax px-2.5 pb-1.5 pt-1">
      <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-wax-ink">{children}</span>
    </span>
  );
}

export function ScorePlate({ score, label = 'SPOILS' }: { score: number; label?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-px rounded-[3px] px-3 pb-2 pt-1.5"
      style={{
        background: 'linear-gradient(#e0b25c,#a67c2c)',
        border: '1.5px solid #64460f',
        boxShadow: 'inset 0 1.5px 0 rgba(255,246,214,0.7), 0 3px 0 #6f4f18',
      }}
    >
      <div className="font-mono text-[8px] tracking-[0.2em] text-[#4a3208]">{label}</div>
      <div className="font-display text-2xl leading-[0.92] text-[#2b1c06]">{score}</div>
    </div>
  );
}

/** The "NOT HERE YET" style stamp that slams in over the screen. */
export function Stamp({
  title,
  sub,
  tone = 'wax',
}: {
  title: string;
  sub?: string;
  tone?: 'wax' | 'moss';
}) {
  const colour = tone === 'moss' ? '#2f5d3a' : '#b8332a';
  return (
    <div
      className="anim-slam pointer-events-none absolute left-1/2 top-1/2 z-30 w-[300px] -translate-x-1/2 -translate-y-1/2 py-4 text-center"
      style={{
        border: `5px double ${colour}`,
        color: colour,
        background: 'rgba(246,236,208,0.55)',
        boxShadow: '0 6px 18px rgba(120,30,24,0.28)',
      }}
    >
      <div className="font-display text-[30px] leading-none">{title}</div>
      {sub && <div className="mt-1.5 font-mono text-[10px] font-bold tracking-[0.24em]">{sub}</div>}
    </div>
  );
}

export function SoundToggle({ dark = false }: { dark?: boolean }) {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundOn()), []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setSound(next);
        setOn(next);
        if (next) tick();
      }}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      className="push flex h-11 w-11 items-center justify-center rounded-full"
      style={{
        border: `2px solid ${dark ? '#33475a' : '#a8946c'}`,
        color: dark ? '#8fa8ba' : '#5d4a30',
      }}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" aria-hidden>
        <path d="M3 10v4h4l5 4V6l-5 4H3Z" />
        {on ? <path d="M16 9a4 4 0 0 1 0 6" strokeLinecap="round" /> : <path d="M16 10l4 4M20 10l-4 4" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10">
      <span className="anim-pulse h-2.5 w-2.5 rounded-full bg-wax" />
      <span className="font-mono text-[11px] tracking-[0.2em] text-ink-3">{label.toUpperCase()}</span>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="anim-rise px-3.5 py-3 font-mono text-[11px] font-bold leading-relaxed tracking-[0.06em]"
      style={{ background: '#b8332a', color: '#fbeeda', boxShadow: '0 4px 0 #7d1c16' }}
      role="alert"
    >
      {children}
    </div>
  );
}
