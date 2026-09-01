import { WorkshopsListing } from "./workshops-listing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workshops | Tutoria",
  description: "Discover hands-on workshops on Tutoria.",
};

export default function WorkshopsPage() {
  return <WorkshopsListing />;
}
