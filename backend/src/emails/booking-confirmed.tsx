import { Heading, Text, Section, Button } from "@react-email/components";
import { EmailLayout } from "./components/email-layout.js";

interface BookingConfirmedProps {
  learnerName: string;
  tutorName: string;
  sessionDate: string;
  sessionTime: string;
  manageUrl: string;
}

export function BookingConfirmedEmail({ learnerName, tutorName, sessionDate, sessionTime, manageUrl }: BookingConfirmedProps) {
  return (
    <EmailLayout preview={`Your lesson with ${tutorName} is confirmed`}>
      <Heading style={{ fontSize: 20, color: "#17181c", marginTop: 0, marginBottom: 16 }}>Your lesson is confirmed</Heading>
      <Text style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
        Hi {learnerName}, your lesson with {tutorName} is confirmed for <strong>{sessionDate}</strong> at <strong>{sessionTime}</strong>.
      </Text>
      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Button href={manageUrl} style={{ backgroundColor: "#17181c", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          View booking
        </Button>
      </Section>
    </EmailLayout>
  );
}
