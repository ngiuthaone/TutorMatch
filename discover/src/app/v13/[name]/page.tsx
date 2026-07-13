import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { UserProfileV13 } from "@/components/discover/user-profile-v13";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <div className="min-h-[100dvh] flex flex-col"><TopNav /><UserProfileV13 name={name} /><Footer /></div>;
}
