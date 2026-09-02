import { Heading, Text, Section, Button } from "@react-email/components";
import { EmailLayout } from "./components/email-layout.js";

interface RefundIssuedProps {
  displayName: string;
  amount: string;
  currency: string;
  bookingUrl: string;
  etaDays?: number;
}

export function RefundIssuedEmail({ displayName, amount, currency, bookingUrl, etaDays = 5 }: RefundIssuedProps) {
  return (
    <EmailLayout preview={`Refund issued: ${amount} ${currency}`}>
      <Heading style={{ fontSize: 20, color: "#17181c", marginTop: 0, marginBottom: 16 }}>Refund issued</Heading>
      <Text style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
        Hi {displayName}, we've issued a refund of <strong>{amount} {currency}</strong>. It may take {etaDays}-{etaDays + 2} business days to appear on your statement.
      </Text>
      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Button href={bookingUrl} style={{ backgroundColor: "#17181c", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          View refund
        </Button>
      </Section>
    </EmailLayout>
  );
}
