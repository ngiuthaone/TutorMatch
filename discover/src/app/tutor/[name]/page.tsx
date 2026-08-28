import { TutorProfileFrame } from "@/components/discover/tutor-profile-frame";

export default async function TutorProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  return <TutorProfileFrame name={name} />;
}
