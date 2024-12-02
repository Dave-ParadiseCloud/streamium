import type { Handle } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import { prisma } from "$lib/server/prisma";
import { RateLimitService } from "$lib/services/rate-limit";


const ADMIN_RATE_LIMIT = 100;
const ADMIN_RATE_WINDOW = 5 * 60 * 1000;
const adminRateLimits = new Map<string, { count: number; firstAttempt: number }>();

function checkAdminRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = adminRateLimits.get(ip);

  if (!limit) {
    adminRateLimits.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (now - limit.firstAttempt >= ADMIN_RATE_WINDOW) {
    adminRateLimits.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (limit.count >= ADMIN_RATE_LIMIT) {
    return false;
  }

  limit.count++;
  adminRateLimits.set(ip, limit);
  return true;
}


setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of adminRateLimits.entries()) {
    if (now - limit.firstAttempt >= ADMIN_RATE_WINDOW) {
      adminRateLimits.delete(key);
    }
  }
}, ADMIN_RATE_WINDOW);

export const handle: Handle = async ({ event, resolve }) => {

  const response = await resolve(event);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "frame-src 'self' " +
    "https://embed.su/ https://*.embed.su/ " +
    "https://vidsrc.pro/ https://*.vidsrc.pro/ " +
    "https://vidsrc.to/ https://*.vidsrc.to/ " +
    "https://vidsrc.cc/ https://*.vidsrc.cc/ " +
    "https://vidsrc.me/ https://*.vidsrc.me/ " +
    "https://2embed.cc/ https://*.2embed.cc/ " +
    "https://vidplay.site/ https://*.vidplay.site/ " +
    "https://vidplay.online/ https://*.vidplay.online/;"
  );


  const isAdminRoute = event.url.pathname.startsWith('/admin');

  try {
    const session = await getSession(event.cookies);

    if (session?.userId) {

      const user = await prisma.user.findUnique({
        where: {
          id: session.userId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          isAdmin: true,
        },
      });

      if (user) {

        event.locals.user = {
          id: user.id,
          username: user.username,
          email: user.email || '',
          isAdmin: user.isAdmin,
        };


        if (isAdminRoute) {
          if (!user.isAdmin) {
            return new Response('Unauthorized', { status: 403 });
          }

          const clientIp = event.getClientAddress();
          if (!checkAdminRateLimit(clientIp)) {
            return new Response('Too Many Requests', { status: 429 });
          }
        }
      } else {

        event.cookies.delete("session", { path: "/" });


        if (isAdminRoute) {
          return new Response('Unauthorized', { status: 403 });
        }
      }
    } else if (isAdminRoute) {

      return new Response('Unauthorized', { status: 403 });
    }
  } catch (error) {

    event.cookies.delete("session", { path: "/" });
    console.error("Session validation error:", error);


    if (isAdminRoute) {
      return new Response('Unauthorized', { status: 403 });
    }
  }

  return response;
};
