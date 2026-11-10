"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PROJECT_CREATE_PATH, projectHref } from "@/lib/project-navigation";
import { api } from "@/trpc/react";

export function ProjectSelection() {
  const router = useRouter();
  // Revalidate on entry so a stale empty cache never bounces a user who just
  // gained access to a project.
  const projects = api.project.list.useQuery(undefined, {
    refetchOnMount: "always",
  });

  // Users without memberships belong in onboarding, not in an empty selector.
  const noMemberships =
    projects.isSuccess && !projects.isFetching && projects.data.length === 0;
  useEffect(() => {
    if (noMemberships) router.replace(PROJECT_CREATE_PATH);
  }, [noMemberships, router]);

  const projectList = projects.data;

  if (!projectList) {
    if (projects.isError) {
      const expired = projects.error.data?.code === "UNAUTHORIZED";
      return (
        <Card className="w-full max-w-xl" role="alert">
          <CardHeader>
            <CardTitle>
              {expired
                ? "Your session has expired"
                : "Couldn't load your projects"}
            </CardTitle>
            <CardDescription>
              {expired
                ? "Sign in again to see your projects."
                : "Something went wrong. Check your connection and try again."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            {expired ? (
              <Button
                nativeButton={false}
                render={<Link href="/login?callbackUrl=%2Fprojects" />}
              >
                Sign in
              </Button>
            ) : (
              <Button onClick={() => void projects.refetch()}>Try again</Button>
            )}
          </CardFooter>
        </Card>
      );
    }

    return (
      <Card className="w-full max-w-xl" aria-busy="true">
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
          <CardDescription>Loading your projects…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (projectList.length === 0) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Checking your projects</CardTitle>
          <CardDescription>
            If you have none yet, we&apos;ll take you to project setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Your projects</CardTitle>
        <CardDescription>Choose a project to open.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {projectList.map((project) => (
            <li key={project.id}>
              <Button
                variant="outline"
                className="w-full justify-start"
                nativeButton={false}
                render={<Link href={projectHref(project.id)} />}
              >
                <span className="truncate">{project.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={PROJECT_CREATE_PATH} />}
        >
          <PlusIcon />
          Create new project
        </Button>
      </CardFooter>
    </Card>
  );
}
