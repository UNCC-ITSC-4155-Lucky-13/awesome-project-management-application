import { Typography } from "@/app/_components/typography";

import type { OnboardingValues } from "./form-state";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, {
    dateStyle: "long",
    timeZone: "UTC",
  });
}

export function ReviewStep({ values }: { values: OnboardingValues }) {
  const description = values.description.trim();
  const duration = Number(values.sprintDurationWeeks);

  return (
    <div className="space-y-4">
      <ReviewRow label="Name">{values.name.trim()}</ReviewRow>
      <ReviewRow label="Description">
        {description === "" ? "None" : description}
      </ReviewRow>
      <ReviewRow label="Sprints">
        {values.sprintsEnabled
          ? `Starting ${formatDate(values.sprintStartDate)}, every ${duration} ${duration === 1 ? "week" : "weeks"}`
          : "Disabled"}
      </ReviewRow>
    </div>
  );
}

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Typography variant="caption">{label}</Typography>
      <Typography className="break-words whitespace-pre-wrap">
        {children}
      </Typography>
    </div>
  );
}
