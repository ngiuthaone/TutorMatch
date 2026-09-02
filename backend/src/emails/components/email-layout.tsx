import { Html, Head, Body, Container, Section, Text, Link, Hr } from "@react-email/components";
import type * as React from "react";

export const FROM_ADDRESS = process.env.RESEND_FROM ?? "Tutoria <noreply@tutoria.com>";
export const BRAND_PRIMARY = "#17181c";
export const BRAND_ACCENT = "#10b981";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <title>{preview}</title>
      </Head>
      <Body style={{ backgroundColor: "#fafafa", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "white", padding: "32px 24px" }}>
          <Section style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: BRAND_PRIMARY, margin: 0 }}>Tutoria</Text>
          </Section>
          {children}
          <Hr style={{ borderColor: "#e5e5e5", margin: "32px 0 16px" }} />
          <Section>
            <Text style={{ fontSize: 12, color: "#71717a", lineHeight: 1.5, margin: 0 }}>
              Tutoria · Vietnam's tutor marketplace<br />
              <Link href="https://tutoria.com" style={{ color: "#71717a" }}>tutoria.com</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
