import { Heading, Text, Section, Button } from "@react-email/components";
import { EmailLayout } from "./components/email-layout.js";

interface PaymentReceivedProps {
  displayName: string;
  amount: string;
  currency: string;
  receiptUrl: string;
}

export function PaymentReceivedEmail({ displayName, amount, currency, receiptUrl }: PaymentReceivedProps) {
  return (
    <EmailLayout preview={`Payment received: ${amount} ${currency}`}>
      <Heading style={{ fontSize: 20, color: "#17181c", marginTop: 0, marginBottom: 16 }}>Payment received</Heading>
      <Text style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
        Hi {displayName}, we received your payment of <strong>{amount} {currency}</strong>.
      </Text>
      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Button href={receiptUrl} style={{ backgroundColor: "#17181c", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          View receipt
        </Button>
      </Section>
    </EmailLayout>
  );
}
