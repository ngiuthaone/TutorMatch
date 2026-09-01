import { TopNav } from "@/components/discover/top-nav";

export const dynamic = "force-dynamic";
import { Footer } from "@/components/discover/footer";
import { UserProfileV7 } from "@/components/discover/user-profile-v7";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <div className="min-h-[100dvh] flex flex-col"><TopNav /><UserProfileV7 name={name} /><Footer /></div>;
}
