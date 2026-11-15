import type { z } from "zod";

import {
  DEFAULT_SPRINT_DURATION_WEEKS,
  projectDetailsSchema,
  sprintSetupSchema,
} from "@/lib/project-schemas";
import type { RouterInputs } from "@/trpc/react";

export type OnboardingValues = {
  name: string;
  description: string;
  sprintsEnabled: boolean;
  sprintStartDate: string; // YYYY-MM-DD from <input type="date">
  sprintDurationWeeks: string; // Kept as text so the field can be edited freely.
};

export type FieldErrors = Partial<Record<keyof OnboardingValues, string>>;

export const initialValues: OnboardingValues = {
  name: "",
  description: "",
  sprintsEnabled: false,
  sprintStartDate: "",
  sprintDurationWeeks: String(DEFAULT_SPRINT_DURATION_WEEKS),
};

function collectErrors(
  error: z.ZodError,
  fieldFor: (path: PropertyKey | undefined) => keyof OnboardingValues,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = fieldFor(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}

export function validateDetails(values: OnboardingValues): FieldErrors {
  const result = projectDetailsSchema.safeParse({
    name: values.name,
    description: values.description,
  });
  if (result.success) return {};
  return collectErrors(result.error, (path) =>
    path === "description" ? "description" : "name",
  );
}

export function validateSprints(values: OnboardingValues): FieldErrors {
  const result = sprintSetupSchema.safeParse(
    values.sprintsEnabled
      ? {
          enabled: true,
          startDate: values.sprintStartDate,
          durationWeeks: Number(values.sprintDurationWeeks),
        }
      : { enabled: false },
  );
  if (result.success) return {};
  return collectErrors(result.error, (path) =>
    path === "durationWeeks" ? "sprintDurationWeeks" : "sprintStartDate",
  );
}

export function toCreateInput(
  values: OnboardingValues,
): RouterInputs["project"]["create"] {
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    description: description === "" ? undefined : description,
    settings: values.sprintsEnabled
      ? {
          // Date-only input; store as midnight UTC so it renders the same everywhere.
          sprintStartDate: new Date(`${values.sprintStartDate}T00:00:00.000Z`),
          sprintDuration: Number(values.sprintDurationWeeks),
        }
      : { sprintStartDate: null },
  };
}
