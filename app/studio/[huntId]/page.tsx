import { StudioEditor } from '@/components/organiser/StudioEditor';

export default async function Page({ params }: { params: Promise<{ huntId: string }> }) {
  const { huntId } = await params;
  return <StudioEditor huntId={huntId} />;
}
