import { RaceControl } from '@/components/organiser/RaceControl';

export default async function Page({ params }: { params: Promise<{ huntId: string }> }) {
  const { huntId } = await params;
  return <RaceControl huntId={huntId} />;
}
