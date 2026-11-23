const MAX_LENGTH = 255;

type ParsedUsername = { value: string } | { error: string };

// Mirrors the invite.send input (trimmed, lowercased, 1–255 characters) and
// also accepts a pasted "@username".
export function parseGithubUsername(input: string): ParsedUsername {
  const value = input.trim().replace(/^@/, "").trim().toLowerCase();

  if (value.length === 0) {
    return { error: "Enter a GitHub username." };
  }
  if (/\s/.test(value)) {
    return { error: "GitHub usernames can't contain spaces." };
  }
  if (value.length > MAX_LENGTH) {
    return { error: `Usernames can be at most ${MAX_LENGTH} characters.` };
  }

  return { value };
}
