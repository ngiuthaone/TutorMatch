import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { UserProfileV4 } from "@/components/discover/user-profile-v4";

export default async function ProfileV4Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav />
      <UserProfileV4 name={name} />
      <Footer />
    </div>
  );
}
