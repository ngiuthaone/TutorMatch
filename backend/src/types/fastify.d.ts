import "fastify";
declare module "fastify" {
  interface FastifyRequest { auth: { userId: string; email: string | null; accessToken: string } }
  interface FastifyInstance { authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void> }
}
