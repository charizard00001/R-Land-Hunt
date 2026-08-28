'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArrivalResult } from '@/lib/types';
import { buzz, chime, coin, stamp as stampSound } from '@/lib/sound';

/** The one emotional beat in the product: the stamp, the count-up, the chime. */
export function ArrivalOverlay({
  result,
  onDone,
}: {
  result: Extract<ArrivalResult, { ok: true }>;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    stampSound();
    buzz([18, 40, 18, 40, 60]);
    const t = setTimeout(chime, 190);

    const total = result.points + (result.finish_bonus ?? 0);
    const step = Math.max(1, Math.round(total / 20));
    let n = 0;
    const iv = setInterval(() => {
      n = Math.min(total, n + step);
      setShown(n);
      coin();
      if (n >= total) clearInterval(iv);
    }, 32);
    timers.current.push(iv);

    return () => {
      clearTimeout(t);
      timers.current.forEach(clearInterval);
      timers.current = [];
    };
  }, [result]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: 'radial-gradient(120% 70% at 50% 30%,#244153 0%,#162933 46%,#0b141a 100%)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-[0.11]"
        style={{
          background: 'repeating-conic-gradient(from 0deg,#e0b25c 0deg 4deg,transparent 4deg 16deg)',
          animation: 'rayspin 22s linear infinite',
        }}
      />
      <style>{`@keyframes rayspin{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}`}</style>

      <div className="anim-pop relative flex h-[116px] w-[116px] items-center justify-center rounded-full"
        style={{ background: '#2f5d3a', boxShadow: '0 8px 0 #1e3f26, 0 16px 26px rgba(30,63,38,0.42)' }}>
        <svg viewBox="0 0 64 64" width="46" height="46" fill="none" stroke="#eaf6ec" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 34 L26 48 L52 18" />
        </svg>
      </div>

      <h2 className="anim-rise mt-6 font-display text-[40px] leading-none tracking-[-0.02em] text-[#f6ecd6]">
        {result.finished ? 'HUNT COMPLETE' : 'MARK CLAIMED'}
      </h2>

      <div className="anim-rise mt-4 flex items-end gap-3">
        <span className="font-display text-[64px] leading-[0.86] text-[#f0bd6a]"
          style={{ textShadow: '0 3px 14px rgba(240,189,106,0.45)' }}>
          +{shown}
        </span>
        <span className="pb-3 font-mono text-[10px] font-bold tracking-[0.24em] text-[#8aa6b4]">
          SPOILS TAKEN
        </span>
      </div>

      <div className="anim-rise mt-5 flex flex-wrap items-center justify-center gap-2">
        {result.first_blood && (
          <span className="bg-wax px-2.5 pb-1.5 pt-1 font-mono text-[9px] font-bold tracking-[0.12em] text-wax-ink">
            FIRST BLOOD
          </span>
        )}
        {result.finished && result.finish_bonus > 0 && (
          <span className="px-2.5 pb-1.5 pt-1 font-mono text-[9px] font-bold tracking-[0.12em] text-[#8fd6a0]"
            style={{ border: '1.5px solid #2f5d3a' }}>
            FINISH BONUS +{result.finish_bonus}
          </span>
        )}
        <span className="px-2.5 pb-1.5 pt-1 font-mono text-[9px] tracking-[0.12em] text-[#8aa6b4]"
          style={{ border: '1.5px solid #4c6c7c' }}>
          RUNNING TOTAL {result.score}
        </span>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="btn-brass push mt-10 flex min-h-[74px] w-full max-w-sm items-center justify-center gap-3 rounded"
      >
        <span className="font-display text-[27px] tracking-[-0.01em]">
          {result.finished ? 'SEE THE RECKONING' : 'ONWARD'}
        </span>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12h15" /><path d="M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
