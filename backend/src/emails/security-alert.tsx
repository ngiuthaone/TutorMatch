import { Heading, Text, Section } from "@react-email/components";
import { EmailLayout } from "./components/email-layout.js";

interface SecurityAlertProps {
  event: string;
  ip?: string;
  when: string;
}

export function SecurityAlertEmail({ event, ip, when }: SecurityAlertProps) {
  return (
    <EmailLayout preview={`Security alert: ${event}`}>
      <Heading style={{ fontSize: 20, color: "#17181c", marginTop: 0, marginBottom: 16 }}>Security alert: {event}</Heading>
      <Text style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
        We detected a {event.toLowerCase()} on your account.
      </Text>
      <Section style={{ backgroundColor: "#fafafa", padding: 16, borderRadius: 8, margin: "16px 0" }}>
        {ip && <Text style={{ margin: 0, fontSize: 13, color: "#3f3f46" }}>IP address: {ip}</Text>}
        <Text style={{ margin: 0, fontSize: 13, color: "#3f3f46" }}>When: {when}</Text>
      </Section>
      <Text style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
        If this wasn't you, change your password immediately and contact support.
      </Text>
    </EmailLayout>
  );
}
