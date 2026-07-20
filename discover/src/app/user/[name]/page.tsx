import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { CommunityUserProfile } from "@/components/discover/community-user-profile";

export default async function CommunityUserProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <CommunityUserProfile name={decodeURIComponent(name)} />
      <Footer />
    </div>
  );
}
