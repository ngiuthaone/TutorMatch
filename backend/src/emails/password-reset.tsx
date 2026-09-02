import { Heading, Text, Button, Section } from "@react-email/components";
import { EmailLayout } from "./components/email-layout.js";

interface PasswordResetEmailProps {
  resetLink: string;
  expiresInMinutes?: number;
}

export function PasswordResetEmail({ resetLink, expiresInMinutes = 60 }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Tutoria password">
      <Heading style={{ fontSize: 20, color: "#17181c", marginTop: 0, marginBottom: 16 }}>Reset your password</Heading>
      <Text style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
        We received a request to reset your Tutoria password. Click the button below to choose a new one.
      </Text>
      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Button href={resetLink} style={{ backgroundColor: "#17181c", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Reset password
        </Button>
      </Section>
      <Text style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
        This link expires in {expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
