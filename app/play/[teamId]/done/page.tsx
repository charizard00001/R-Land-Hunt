import { RecapClient } from '@/components/play/RecapClient';

export default async function Page({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <RecapClient teamId={teamId} />;
}
