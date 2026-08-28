'use client';

import { useState } from 'react';
import { sb } from '@/lib/supabase/client';
import type { ActiveNode, HintResult } from '@/lib/types';
import { reasonText } from '@/lib/types';
import { buzz, spend, tear, thunk } from '@/lib/sound';
import { ErrorNote, MonoLabel } from '@/components/Chrome';

const EDGE = ['#7a6749', '#b8873a', '#b8332a', '#6a120e'];

export function HintSheet({
  teamId,
  node,
  score,
  onClose,
  onBought,
}: {
  teamId: string;
  node: ActiveNode;
  score: number;
  onClose: () => void;
  onBought: () => void;
}) {
  const [hints, setHints] = useState(node.hints);
  const [live, setLive] = useState(score);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spent = hints.filter((h) => h.bought).reduce((n, h) => n + h.cost, 0);
  const nextTier = hints.findIndex((h) => !h.bought) + 1;

  async function buy(tier: number) {
    if (busy) return;
    if (tier !== nextTier) {
      setError('Take the hints in order — cheapest first.');
      return;
    }
    setBusy(tier);
    setError(null);
    tear();
    buzz(25);

    const { data, error: rpcError } = await sb().rpc('buy_hint', {
      p_team: teamId, p_node: node.node_id, p_tier: tier,
    });
    setBusy(null);

    if (rpcError) { setError(rpcError.message); return; }
    const r = data as HintResult;
    if (!r.ok) { setError(reasonText(r.reason)); return; }

    setTimeout(spend, 130);
    setHints((hs) => hs.map((h) => (h.tier === tier ? { ...h, bought: true, text: r.text } : h)));
    setLive(r.score);
    onBought();
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close hints"
        onClick={() => { thunk(); onClose(); }}
        className="absolute inset-0 bg-[#14100c]/70"
      />

      <section
        className="anim-rise grain relative mx-auto w-full max-w-md rounded-t-[6px] px-4 pb-7 pt-3.5"
        style={{
          background: 'radial-gradient(120% 60% at 50% 0%,#f4e8ca 0%,#e2d3af 50%,#cdbc95 100%)',
          borderTop: '3px solid #8a7351',
          boxShadow: '0 -16px 34px rgba(0,0,0,0.6)',
        }}
      >
        <div className="relative flex flex-col items-center gap-3">
          <span
            className="h-2 w-20 rounded"
            style={{ background: 'repeating-linear-gradient(45deg,#9c7f57 0 4px,#7e6440 4px 8px)' }}
          />
          <div className="flex flex-col items-center gap-1.5">
            <h2 className="font-display text-[32px] leading-none tracking-[-0.02em]">THE INFORMANT</h2>
            <p className="font-body text-[17px] font-medium italic text-wax">he does not work for free</p>
          </div>
        </div>

        {error && <div className="relative mt-4"><ErrorNote>{error}</ErrorNote></div>}

        <div className="relative mt-4 flex flex-col gap-2.5">
          {hints.length === 0 && (
            <p className="py-6 text-center font-body text-[15px] italic text-ink-3">
              He has nothing to sell you on this mark. You are on your own.
            </p>
          )}

          {hints.map((h, i) => {
            const edge = EDGE[Math.min(i, EDGE.length - 1)];
            const locked = !h.bought && h.tier !== nextTier;
            return (
              <button
                key={h.tier}
                type="button"
                disabled={h.bought || locked || busy !== null}
                onClick={() => buy(h.tier)}
                className="push relative w-full px-4 pb-3.5 pt-3 text-left disabled:cursor-default"
                style={{
                  background: h.bought ? 'linear-gradient(#f8eed4,#ecdfbe)' : 'linear-gradient(#ece0bf,#dccca6)',
                  border: '2px solid #a8946c',
                  borderLeft: `6px solid ${edge}`,
                  boxShadow: '0 4px 0 #97815a',
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-display text-[17px] leading-tight tracking-[-0.01em]">
                      {['A NUDGE', 'A HINT', 'PLAIN WORDS', 'THE LOT'][i] ?? `HINT ${h.tier}`}
                    </span>
                    <MonoLabel className="tracking-[0.1em]">
                      {h.bought ? 'PAID FOR' : locked ? 'TAKE THEM IN ORDER' : 'HE WILL TELL YOU FOR A PRICE'}
                    </MonoLabel>
                  </div>
                  <span
                    className="shrink-0 px-2.5 pb-1.5 pt-1.5 font-display text-base"
                    style={{
                      background: h.bought ? edge : 'rgba(255,250,235,0.6)',
                      border: `1.5px solid ${edge}`,
                      color: h.bought ? '#fbeeda' : edge,
                    }}
                  >
                    {busy === h.tier ? '…' : h.bought ? 'PAID' : `-${h.cost}`}
                  </span>
                </div>

                {h.bought && h.text && (
                  <div
                    className="anim-unfurl mt-3 px-3.5 pb-3 pt-2.5"
                    style={{ background: 'rgba(255,250,235,0.72)', border: '1px dashed #b0996d' }}
                  >
                    <p className="font-body text-base font-semibold leading-relaxed">{h.text}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div
          className="relative mt-5 flex items-center justify-between gap-3 pt-4"
          style={{ borderTop: '2px solid rgba(138,115,81,0.55)' }}
        >
          <div className="flex flex-col gap-0.5">
            <MonoLabel className="tracking-[0.18em]">LEDGER THIS MARK</MonoLabel>
            <span
              className="font-display text-[19px]"
              style={{ color: spent ? '#b8332a' : '#7a6749' }}
            >
              {spent ? `-${spent} SPOILS` : 'NOTHING OWED'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <MonoLabel className="tracking-[0.18em]">LEFT</MonoLabel>
              <span className="font-display text-[19px]">{live}</span>
            </div>
            <button
              type="button"
              onClick={() => { thunk(); onClose(); }}
              className="btn-dark push flex min-h-[52px] items-center px-5 font-display text-base"
            >
              BACK TO THE HUNT
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
