import { TutorProfileFrame } from "@/components/discover/tutor-profile-frame";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  return <TutorProfileFrame name={name} />;
}
