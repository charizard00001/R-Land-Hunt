const POINTS = [
  'north', 'north-east', 'east', 'south-east',
  'south', 'south-west', 'west', 'north-west',
];

/** "east-north-east" style label from a compass bearing in degrees. */
export function compassLabel(deg: number): string {
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return POINTS[i];
}

export function formatDistance(m: number): { value: string; unit: string } {
  if (m >= 1000) return { value: (m / 1000).toFixed(1), unit: 'KILOMETRES OFF' };
  return { value: String(Math.round(m)), unit: 'METRES OFF' };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatAgo(seconds: number | null | undefined): string {
  if (seconds == null) return 'never';
  if (seconds < 60) return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}
