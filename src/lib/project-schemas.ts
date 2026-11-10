import { z } from "zod";

export const DEFAULT_SPRINT_DURATION_WEEKS = 2;

// Shared by the project router and the onboarding form so the rules stay in sync.
export const projectName = z.string().trim().min(1).max(255);

export const projectDetailsSchema = z.object({
  name: projectName,
  description: z.string().trim(),
});

export const sprintSetupSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    // Value of an <input type="date">, formatted YYYY-MM-DD.
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a start date.")
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "Enter a valid date.",
      ),
    durationWeeks: z
      .number({ message: "Enter the duration in weeks." })
      .int("Duration must be a whole number of weeks.")
      .positive("Duration must be at least 1 week."),
  }),
]);
