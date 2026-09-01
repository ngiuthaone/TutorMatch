import type { FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * Auth BFF (backend-for-frontend) for the discover web shell.
 *
 * Uses the publishable (anon) Supabase key, NOT the service-role key. Sign-in
 * is a public endpoint; using the publishable key is the least-privilege
 * design and matches how every other public Supabase client authenticates
 * users. The discover shell receives the publishable key only, so the
 * service-role key never needs to leave the backend operator.
 *
 * Dedicated rate limit: 10/min/IP on sign-in and refresh. The default global
 * rate limit (200/min) is too lax for credential-stuffing protection.
 */
const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export interface AuthBffOptions {
  supabaseUrl: string;
  supabasePublishableKey: string;
  signInRateMax: number;
  signInWindowMs: number;
}

const authBffRoutes: FastifyPluginAsync<AuthBffOptions> = async (app, options) => {
  const supabasePublic = createClient(options.supabaseUrl, options.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  app.post('/api/v1/auth/sign-in', {
    config: { rateLimit: { max: options.signInRateMax, timeWindow: options.signInWindowMs } },
  }, async (request, reply) => {
    const parsed = signInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid email or password format.' } });
    }
    const body = request.body as { email: string; password: string };
    let data, error;
    try {
      ({ data, error } = await supabasePublic.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      }));
    } catch (err) {
      request.log.error({ err }, 'signInWithPassword threw');
      return reply.status(500).send({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during sign-in.' } });
    }
    if (error || !data.session) {
      // Generic message: do not disclose whether the email exists.
      return reply.status(401).send({ ok: false, error: { code: 'AUTH_FAILED', message: 'Sign-in failed.' } });
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

  app.post('/api/v1/auth/refresh', {
    config: { rateLimit: { max: options.signInRateMax, timeWindow: options.signInWindowMs } },
  }, async (request, reply) => {
    const refreshToken = request.cookies['tutoria_refresh_token'];
    if (!refreshToken) {
      return reply.status(401).send({ ok: false, error: { code: 'NO_TOKEN', message: 'No refresh token' } });
    }
    let data, error;
    try {
      ({ data, error } = await supabasePublic.auth.refreshSession({ refresh_token: refreshToken }));
    } catch (err) {
      request.log.error({ err }, 'refreshSession threw');
      return reply.status(500).send({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during token refresh.' } });
    }
    if (error || !data.session) {
      reply.clearCookie('tutoria_refresh_token');
      return reply.status(401).send({ ok: false, error: { code: 'REFRESH_FAILED', message: 'Refresh failed' } });
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
