import { PlayClient } from '@/components/play/PlayClient';

export default async function PlayPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <PlayClient teamId={teamId} />;
}
