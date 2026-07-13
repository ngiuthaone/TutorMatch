import { TopNav } from "@/components/discover/top-nav";
import { DiscoverHome } from "@/components/discover/discover-home";
import { Footer } from "@/components/discover/footer";

export default function DiscoverPage() {
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <DiscoverHome />
      <Footer />
    </div>
  );
}
