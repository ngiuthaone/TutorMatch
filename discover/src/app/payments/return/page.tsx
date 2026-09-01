import { requireServerSession } from "@/lib/auth/server-guard";
import PaymentReturnView from "@/components/payments/payment-return-view";

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ bookingId?: string | string[] }> }) {
  await requireServerSession();
  const params = await searchParams;
  const raw = params.bookingId;
  const bookingId = Array.isArray(raw) ? raw[0] : raw;
  return <PaymentReturnView bookingId={bookingId ?? ""} />;
}
