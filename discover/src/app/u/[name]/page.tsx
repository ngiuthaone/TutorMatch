import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { UserProfileV2 } from "@/components/discover/user-profile-v2";

export default async function ProfileV2Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav />
      <UserProfileV2 name={name} />
      <Footer />
    </div>
  );
}
