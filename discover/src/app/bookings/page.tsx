export const dynamic = "force-dynamic";

import { requireServerSession } from "@/lib/auth/server-guard";
import BookingsClient from "./bookings-client";

export default async function Page() {
  await requireServerSession();
  return <BookingsClient />;
}
