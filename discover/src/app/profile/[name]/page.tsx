import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { ProfileReplacement } from "@/components/discover/profile-replacement";

export default async function ProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <ProfileReplacement name={decodeURIComponent(name)} />
      <Footer />
    </div>
  );
}
