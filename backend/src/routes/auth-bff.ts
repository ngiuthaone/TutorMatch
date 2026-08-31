import type { FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const authBffRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/v1/auth/sign-in', async (request, reply) => {
    const parsed = signInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid email or password format.' } });
    }
    const body = request.body as { email: string; password: string };
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.session) {
      return reply.status(401).send({ ok: false, error: { code: 'AUTH_FAILED', message: error?.message ?? 'Sign-in failed' } });
    }
    reply.setCookie('tutoria_refresh_token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return { ok: true, user: data.user };
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies['tutoria_refresh_token'];
    if (!refreshToken) {
      return reply.status(401).send({ ok: false, error: { code: 'NO_TOKEN', message: 'No refresh token' } });
    }
    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      reply.clearCookie('tutoria_refresh_token');
      return reply.status(401).send({ ok: false, error: { code: 'REFRESH_FAILED', message: error?.message ?? 'Refresh failed' } });
    }
    reply.setCookie('tutoria_refresh_token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return { ok: true, user: data.user };
  });

  app.post('/api/v1/auth/sign-out', async (_request, reply) => {
    reply.clearCookie('tutoria_refresh_token');
    return { ok: true };
  });
};

export default authBffRoutes;
