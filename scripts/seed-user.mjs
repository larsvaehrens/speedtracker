const username = process.env.SPEEDTRACKER_SEED_USERNAME;
const screenName = process.env.SPEEDTRACKER_SEED_SCREEN_NAME;
const password = process.env.SPEEDTRACKER_SEED_PASSWORD;
const baseUrl = process.env.SPEEDTRACKER_BASE_URL ?? "http://localhost:3000";

if (!username || !screenName || !password) {
  console.error(
    "Set SPEEDTRACKER_SEED_USERNAME, SPEEDTRACKER_SEED_SCREEN_NAME, and SPEEDTRACKER_SEED_PASSWORD.",
  );
  process.exit(1);
}

if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
  console.error("The seed username must use 3–24 letters, numbers, or underscores.");
  process.exit(1);
}

if (screenName.trim().length < 2 || screenName.trim().length > 24) {
  console.error("The seed screen name must be 2–24 characters.");
  process.exit(1);
}

if (password.length < 10 || password.length > 128) {
  console.error("The seed password must be 10–128 characters.");
  process.exit(1);
}

const url = new URL(baseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  console.error("Development user seeding is restricted to localhost.");
  process.exit(1);
}

const response = await fetch(new URL("/api/auth/sign-up/email", url), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: `${username.toLowerCase()}@accounts.speedtracker.invalid`,
    username,
    displayUsername: username,
    name: screenName.trim(),
    password,
  }),
});

let result;
try {
  result = await response.json();
} catch (error) {
  if (!(error instanceof SyntaxError) && !(error instanceof TypeError)) throw error;
}

if (!response.ok) {
  console.error(
    typeof result?.message === "string"
      ? result.message
      : `User seed failed with HTTP ${response.status}.`,
  );
  process.exit(1);
}

console.log(`Created local Player @${username}.`);
