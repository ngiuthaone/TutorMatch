import { ContentStubBanner } from "@/components/content-stubs/content-stub-banner";
import { CoursesEmbed } from "./courses-embed";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <ContentStubBanner surface="courses" />
      <CoursesEmbed />
    </>
  );
}
