import type { FastifyPluginAsync } from "fastify";
import { sendEmail, EmailTemplates } from "../services/email.js";

const securityAlertRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/v1/auth/security-alert", {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: "object",
        required: ["event"],
        properties: {
          event: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    const { event } = request.body as { event: string };
    const email = request.auth.email;
    const userId = request.auth.userId;
    if (!email) return reply.status(400).send({ error: "user has no email" });
    const tpl = EmailTemplates.securityAlert(event);
    const result = await sendEmail({ to: email, ...tpl });
    if ("error" in result) {
      request.log.error({ err: result.error, event, userId }, "security alert email failed");
      return reply.status(500).send({ error: "email_failed" });
    }
    return reply.send({ id: result.id });
  });
};

export default securityAlertRoutes;
