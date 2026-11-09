"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  PROJECT_CREATE_PATH,
  projectHref,
  recoveryPath,
} from "@/lib/project-navigation";
import { api } from "@/trpc/react";
import { ChevronsUpDownIcon, FolderIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProjectSwitcher({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  // Revalidate whenever a project opens so a stale cache (for example a project
  // created in another tab) is never mistaken for lost access.
  const projects = api.project.list.useQuery(undefined, {
    refetchOnMount: "always",
  });

  const activeProject = projects.data?.find(
    (project) => project.id === projectId,
  );
  // Once the memberships are fresh, a missing active project means it was
  // deleted or the user lost access. Choose project selection or onboarding.
  const settled = projects.isSuccess && !projects.isFetching;
  const recoveryHref =
    settled && !activeProject ? recoveryPath(projects.data ?? []) : null;
  useEffect(() => {
    if (recoveryHref) router.replace(recoveryHref);
  }, [recoveryHref, router]);

  function selectProject(selectedId: string) {
    setOpenMobile(false);
    if (selectedId !== projectId) router.push(projectHref(selectedId));
  }

  let label: string;
  if (activeProject) {
    label = activeProject.name;
  } else if (!projects.data && projects.isError) {
    label = "Projects unavailable";
  } else if (settled) {
    label = "Project unavailable";
  } else {
    label = "Loading…";
  }

  let items: React.ReactNode;
  if (projects.data) {
    items =
      projects.data.length === 0 ? (
        <DropdownMenuItem disabled>No projects</DropdownMenuItem>
      ) : (
        <DropdownMenuRadioGroup
          value={projectId}
          onValueChange={(value) => {
            if (typeof value === "string") selectProject(value);
          }}
        >
          {projects.data.map((project) => (
            <DropdownMenuRadioItem key={project.id} value={project.id}>
              <span className="truncate">{project.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      );
  } else if (projects.isError) {
    const expired = projects.error.data?.code === "UNAUTHORIZED";
    items = (
      <>
        <DropdownMenuItem disabled>
          {expired ? "Your session has expired" : "Couldn't load projects"}
        </DropdownMenuItem>
        {expired ? (
          <DropdownMenuItem
            render={
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(projectHref(projectId))}`}
              />
            }
          >
            Sign in again
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void projects.refetch()}>
            Try again
          </DropdownMenuItem>
        )}
      </>
    );
  } else {
    items = <DropdownMenuItem disabled>Loading projects…</DropdownMenuItem>;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <FolderIcon />
            <span className="truncate">{label}</span>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              {items}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href={PROJECT_CREATE_PATH} />}
              onClick={() => setOpenMobile(false)}
            >
              <PlusIcon />
              Create new project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
