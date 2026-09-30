const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

export function validateUsername(username: string): boolean {
  return usernamePattern.test(username);
}

export function internalAuthEmail(username: string): string {
  if (!validateUsername(username)) {
    throw new Error("Username must be 3–24 letters, numbers, or underscores.");
  }

  return `${username.toLowerCase()}@accounts.speedtracker.invalid`;
}
