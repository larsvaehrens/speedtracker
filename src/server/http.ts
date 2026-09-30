import { auth } from "./auth";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

export async function currentUser(request: Request) {
  const result = await auth.api.getSession({ headers: request.headers });
  return result?.user ?? null;
}

export function unauthorized(): Response {
  return json({ error: "Sign in to continue." }, 401);
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export function conflict(message: string): Response {
  return json({ error: message }, 409);
}

export function unavailable(): Response {
  return json({ error: "This resource is unavailable." }, 404);
}
