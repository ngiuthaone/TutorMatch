import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { UserProfileV5 } from "@/components/discover/user-profile-v5";

export default async function ProfileV5Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopNav />
      <UserProfileV5 name={name} />
      <Footer />
    </div>
  );
}
