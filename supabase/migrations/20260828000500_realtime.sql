-- Realtime. One channel per hunt; every payload is scoped to a hunt, so ending
-- hunt A can never touch hunt B (which is exactly what v1 did).

alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table hunts;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table progress;
