import { ClassesListing } from "./classes-listing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Classes | Tutoria",
  description: "Discover hands-on classes on Tutoria.",
};

export default function ClassesPage() {
  return <ClassesListing />;
}
