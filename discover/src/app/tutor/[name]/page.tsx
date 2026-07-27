export default async function TutorProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const profileName = encodeURIComponent(decodeURIComponent(name));

  return (
    <iframe
      src={`/tutor-profile-exact.html?name=${profileName}`}
      title="Tutor profile"
      className="block h-[100dvh] w-full border-0 bg-[#101011]"
    />
  );
}
