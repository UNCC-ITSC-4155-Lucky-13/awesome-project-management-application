"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/trpc/react";

import {
  initialValues,
  toCreateInput,
  validateDetails,
  validateSprints,
  type FieldErrors,
  type OnboardingValues,
} from "./form-state";
import { ProjectDetailsStep } from "./project-details-step";
import { ReviewStep } from "./review-step";
import { SprintSetupStep } from "./sprint-setup-step";

const STEPS = [
  { title: "Project details", description: "Name your project." },
  { title: "Sprint setup", description: "Choose how work is scheduled." },
  { title: "Review & create", description: "Confirm your settings." },
] as const;

export function ProjectOnboarding() {
  const router = useRouter();
  const utils = api.useUtils();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<OnboardingValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  const createProject = api.project.create.useMutation({
    onSuccess: async (project) => {
      await utils.project.list.invalidate();
      router.push(`/project/${encodeURIComponent(project.id)}`);
    },
  });
  // Stay locked after success so a double click can't create a second project
  // while the redirect is in flight.
  const submitting = createProject.isPending || createProject.isSuccess;

  function change(changes: Partial<OnboardingValues>) {
    setValues((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes) as (keyof OnboardingValues)[]) {
        delete next[key];
      }
      return next;
    });
  }

  function next() {
    const found =
      step === 0 ? validateDetails(values) : validateSprints(values);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(step + 1);
  }

  function back() {
    setErrors({});
    createProject.reset();
    setStep(step - 1);
  }

  function create() {
    if (submitting) return;
    createProject.mutate(toCreateInput(values));
  }

  const isReview = step === STEPS.length - 1;

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardDescription>
          Step {step + 1} of {STEPS.length}
        </CardDescription>
        <CardTitle>{STEPS[step]!.title}</CardTitle>
        <CardDescription>{STEPS[step]!.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 && (
          <ProjectDetailsStep
            values={values}
            errors={errors}
            onChange={change}
          />
        )}
        {step === 1 && (
          <SprintSetupStep values={values} errors={errors} onChange={change} />
        )}
        {isReview && <ReviewStep values={values} />}
        {createProject.isError && (
          <FieldError>
            Couldn&apos;t create the project. Your details are still here, so
            you can try again.
          </FieldError>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || submitting}
          onClick={back}
        >
          Back
        </Button>
        {isReview ? (
          <Button type="button" disabled={submitting} onClick={create}>
            {submitting && <Spinner />}
            {createProject.isError ? "Try again" : "Create project"}
          </Button>
        ) : (
          <Button type="button" onClick={next}>
            Next
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
