export function getCurrentSprint(
  startDate: Date | null,
  durationWeeks: number,
  now = new Date(),
) {
  if (!startDate) return null;
  const elapsed = Math.floor(
    (now.getTime() - startDate.getTime()) /
      (durationWeeks * 7 * 24 * 60 * 60 * 1000),
  );
  const sequence = Math.max(1, elapsed + 1);
  return `${startDate.getUTCFullYear()}-${sequence}`;
}

export function getSprintWindow(
  startDate: Date | null,
  durationWeeks: number,
  now = new Date(),
) {
  const current = getCurrentSprint(startDate, durationWeeks, now);
  if (!current) return [];

  const [year, sequence] = current.split("-");
  const previous = Number(sequence) - 1;
  const next = Number(sequence) + 1;
  return [
    ...(previous > 0 ? [`${year}-${previous}`] : []),
    current,
    `${year}-${next}`,
  ];
}
