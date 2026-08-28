'use client';

/** Shown instead of a crash when .env.local has not been filled in yet. */
export function SetupNotice() {
  return (
    <main className="parchment grain relative flex min-h-dvh items-center justify-center px-7 py-12">
      <div
        className="parchment-flat relative w-full max-w-lg px-7 pb-8 pt-7"
        style={{ border: '2px solid #a8946c', boxShadow: '0 8px 0 #97815a, 0 18px 30px rgba(45,30,14,0.28)' }}
      >
        <span className="inline-block bg-wax px-2.5 pb-1.5 pt-1">
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-wax-ink">ONE STEP LEFT</span>
        </span>

        <h1 className="mt-4 font-display text-[32px] leading-none tracking-[-0.02em]">
          THE DATABASE IS NOT WIRED UP
        </h1>

        <p className="mt-4 font-body text-[16px] font-medium leading-relaxed">
          The app is built and running — it just has nowhere to keep the hunt yet.
          Start the local stack and paste the two keys it prints into{' '}
          <code className="font-mono text-[14px] text-wax">.env.local</code>.
        </p>

        <pre
          className="mt-5 overflow-x-auto px-4 py-3.5 font-mono text-[12px] leading-relaxed"
          style={{ background: '#241708', color: '#e0b25c', border: '2px solid #120c05' }}
        >
{`npm run db:start      # boots Postgres, Auth and Realtime
# copy "API URL" and "anon key" into .env.local
npm run dev`}
        </pre>

        <p className="mt-5 font-mono text-[11px] leading-relaxed tracking-[0.08em] text-ink-3">
          NEEDS DOCKER AND THE SUPABASE CLI. THE README HAS THE HOSTED ROUTE TOO.
        </p>
      </div>
    </main>
  );
}
