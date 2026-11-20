const SPRINT_TAG = /^(\d{4})-(\d+)$/;

/**
 * Turns a stored sprint tag such as `2026-4` into a readable label
 * (`Sprint 4, 2026`). Returns null for a tag in any other format so callers
 * never show the raw value.
 */
export const formatSprintLabel = (sprintNumber: string) => {
  const match = SPRINT_TAG.exec(sprintNumber);
  if (!match) return null;
  const [, year, number] = match;
  return `Sprint ${Number(number)}, ${year}`;
};
