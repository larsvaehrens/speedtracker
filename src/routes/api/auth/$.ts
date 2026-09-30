import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { internalAuthEmail, validateUsername } from "#/domain/identity";
import { auth } from "#/server/auth";

const rateLimitedPaths = new Set(["/api/auth/sign-in/username", "/api/auth/sign-up/email"]);

async function hasUsernameOnlySignup(request: Request): Promise<boolean> {
  let payload: unknown;
  try {
    payload = await request.clone().json();
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return false;
    throw error;
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }

  const body = payload as Record<string, unknown>;
  return (
    typeof body.username === "string" &&
    validateUsername(body.username) &&
    body.email === internalAuthEmail(body.username) &&
    typeof body.name === "string" &&
    body.name.trim().length >= 2 &&
    body.name.trim().length <= 24
  );
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const pathname = new URL(request.url).pathname;

        if (pathname === "/api/auth/sign-up/email" && !(await hasUsernameOnlySignup(request))) {
          return Response.json(
            { message: "Sign up with a login username and screen name." },
            { status: 400 },
          );
        }

        if (rateLimitedPaths.has(pathname)) {
          const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
          const result = await env.AUTH_RATE_LIMITER.limit({
            key: `${pathname}:${ip}`,
          });
          if (!result.success) {
            return Response.json(
              { message: "Too many attempts. Try again shortly." },
              { status: 429 },
            );
          }
        }

        return auth.handler(request);
      },
    },
  },
});
