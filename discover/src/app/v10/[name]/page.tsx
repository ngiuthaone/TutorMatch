import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { UserProfileV10 } from "@/components/discover/user-profile-v10";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <div className="min-h-[100dvh] flex flex-col"><TopNav /><UserProfileV10 name={name} /><Footer /></div>;
}
