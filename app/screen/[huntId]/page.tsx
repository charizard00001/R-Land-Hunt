import { BigScreen } from '@/components/organiser/BigScreen';

export default async function Page({ params }: { params: Promise<{ huntId: string }> }) {
  const { huntId } = await params;
  return <BigScreen huntId={huntId} />;
}
