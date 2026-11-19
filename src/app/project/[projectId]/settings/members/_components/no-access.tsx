"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PROJECT_SELECTION_PATH } from "@/lib/project-navigation";
import { api } from "@/trpc/react";

// Shown when the server says the user is no longer a member of this project.
export function NoAccess() {
  const utils = api.useUtils();

  // Refresh memberships. The project switcher then sends the user to project
  // selection or onboarding.
  useEffect(() => {
    void utils.project.list.invalidate();
  }, [utils]);

  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle>You no longer have access to this project</CardTitle>
        <CardDescription>
          Your membership may have been removed or the project deleted.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          nativeButton={false}
          render={<Link href={PROJECT_SELECTION_PATH} />}
        >
          Go to your projects
        </Button>
      </CardFooter>
    </Card>
  );
}
