import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { UserProfileV3 } from "@/components/discover/user-profile-v3";

export default async function ProfileV3Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav />
      <UserProfileV3 name={name} />
      <Footer />
    </div>
  );
}
