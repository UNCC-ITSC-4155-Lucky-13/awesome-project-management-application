import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { FieldErrors, OnboardingValues } from "./form-state";

export function SprintSetupStep({
  values,
  errors,
  onChange,
}: {
  values: OnboardingValues;
  errors: FieldErrors;
  onChange: (changes: Partial<OnboardingValues>) => void;
}) {
  const disabled = !values.sprintsEnabled;

  return (
    <FieldGroup>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="sprints-enabled">Enable sprints</FieldLabel>
          <FieldDescription>
            Plan work in repeating, fixed-length sprints.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="sprints-enabled"
          checked={values.sprintsEnabled}
          onCheckedChange={(checked) => onChange({ sprintsEnabled: checked })}
        />
      </Field>
      <Field data-invalid={!!errors.sprintStartDate} data-disabled={disabled}>
        <FieldLabel htmlFor="sprint-start-date">Sprint start date</FieldLabel>
        <Input
          id="sprint-start-date"
          type="date"
          value={values.sprintStartDate}
          disabled={disabled}
          aria-invalid={!!errors.sprintStartDate}
          onChange={(event) => onChange({ sprintStartDate: event.target.value })}
        />
        <FieldError>{errors.sprintStartDate}</FieldError>
      </Field>
      <Field
        data-invalid={!!errors.sprintDurationWeeks}
        data-disabled={disabled}
      >
        <FieldLabel htmlFor="sprint-duration">
          Sprint duration (weeks)
        </FieldLabel>
        <Input
          id="sprint-duration"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={values.sprintDurationWeeks}
          disabled={disabled}
          aria-invalid={!!errors.sprintDurationWeeks}
          onChange={(event) =>
            onChange({ sprintDurationWeeks: event.target.value })
          }
        />
        <FieldError>{errors.sprintDurationWeeks}</FieldError>
      </Field>
    </FieldGroup>
  );
}
