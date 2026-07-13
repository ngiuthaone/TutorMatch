import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { TagPage } from "@/components/discover/tag-page";

export default async function TagPageRoute({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <TagPage tag={tag} />
      <Footer />
    </div>
  );
}
