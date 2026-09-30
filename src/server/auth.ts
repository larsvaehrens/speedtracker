import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { authSchema } from "./db/schema";

const database = drizzle(env.DB, { schema: authSchema });

export const auth = betterAuth({
  database: drizzleAdapter(database, {
    provider: "sqlite",
    schema: authSchema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: false,
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
  },
  plugins: [username(), tanstackStartCookies()],
});
