import { BoardClient } from '@/components/play/BoardClient';

export default async function Page({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <BoardClient teamId={teamId} />;
}
