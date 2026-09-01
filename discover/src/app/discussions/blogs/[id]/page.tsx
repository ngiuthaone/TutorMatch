import { TopNav } from "@/components/discover/top-nav";

export const dynamic = "force-dynamic";
import { Footer } from "@/components/discover/footer";
import { BlogDetail } from "@/components/discover/discussion-thread";

export default async function BlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <BlogDetail id={id} />
      <Footer />
    </div>
  );
}
