import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { FieldErrors, OnboardingValues } from "./form-state";

export function ProjectDetailsStep({
  values,
  errors,
  onChange,
}: {
  values: OnboardingValues;
  errors: FieldErrors;
  onChange: (changes: Partial<OnboardingValues>) => void;
}) {
  return (
    <FieldGroup>
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="project-name">Project name</FieldLabel>
        <Input
          id="project-name"
          value={values.name}
          maxLength={255}
          aria-invalid={!!errors.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <FieldError>{errors.name}</FieldError>
      </Field>
      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="project-description">
          Description (optional)
        </FieldLabel>
        <Textarea
          id="project-description"
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <FieldError>{errors.description}</FieldError>
      </Field>
    </FieldGroup>
  );
}
