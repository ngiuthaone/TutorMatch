import { PeopleBrowser } from "./people-browser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse Tutors | Tutoria",
  description: "Browse tutors on Tutoria.",
};

export default function People() {
  return <PeopleBrowser />;
}
