import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { DiscoverHome } from "@/components/discover/discover-home";
import { Footer } from "@/components/discover/footer";

export default function DiscoverPage() {
  return (
    <div className="tutoria-page-shell tutoria-discover-shell flex flex-col">
      <CollapsibleHeader className="tutoria-discover-header">
        <TopNav />
      </CollapsibleHeader>
      <DiscoverHome />
      <Footer />
    </div>
  );
}
