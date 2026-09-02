import { Heading, Text, Button, Section } from "@react-email/components";
import { EmailLayout } from "./components/email-layout.js";

interface EmailVerificationProps {
  verifyLink: string;
  displayName: string;
}

export function EmailVerificationEmail({ verifyLink, displayName }: EmailVerificationProps) {
  return (
    <EmailLayout preview="Welcome to Tutoria">
      <Heading style={{ fontSize: 20, color: "#17181c", marginTop: 0, marginBottom: 16 }}>Welcome to Tutoria</Heading>
      <Text style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
        Hi {displayName}, click the button below to verify your email and finish setting up your account.
      </Text>
      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Button href={verifyLink} style={{ backgroundColor: "#17181c", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Verify email
        </Button>
      </Section>
    </EmailLayout>
  );
}
