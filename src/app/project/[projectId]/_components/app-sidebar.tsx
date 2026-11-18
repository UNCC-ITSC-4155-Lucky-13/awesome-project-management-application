"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BarChart3Icon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  UserCogIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ProjectSwitcher } from "./project-switcher";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ViewIcon } from "@/app/_components/ViewIcon";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const projectPath = `/project/${encodeURIComponent(projectId)}`;
  const { setOpenMobile } = useSidebar();

  const utils = api.useContext();
  const { data: me } = api.user.me.useQuery();
  const currentUserId = me?.id;

  // ── Create-view dialog ─────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState<"personal" | "workspace">(
    "personal",
  );

  const createMutation = api.view.create.useMutation({
    onSuccess: (view) => {
      void utils.view.list.invalidate({ projectId });
      toast.success("View created");
      setCreateOpen(false);
      setNewName("");
      router.push(`${projectPath}/views/${view.id}`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to create view"),
  });

  const handleCreateView = () => {
    if (!newName.trim()) {
      toast.error("View name cannot be empty");
      return;
    }
    createMutation.mutate({
      projectId,
      name: newName.trim(),
      icon: "layout-dashboard",
      configuration: {
        columns: ["backlog", "todo", "in_progress", "done"],
        groupBy: "status",
        rowSplit: null,
        filters: {},
        sort: null,
      },
      scope: newScope,
    });
  };

  // ── Membership & views queries ────────────────────────────────────────────
  const { data: membership, error: membershipError } = api.member.list.useQuery(
    { projectId },
  );
  const myMembership = membership?.find((m) => m.userId === currentUserId);
  const isManager =
    myMembership?.role === "owner" || myMembership?.role === "admin";

  const { data: allViews = [], error: viewsError } = api.view.list.useQuery({
    projectId,
  });
  const workspaceViews = allViews.filter((v) => v.ownerUserId === null);
  const myViews = allViews.filter((v) => v.ownerUserId === currentUserId);

  // ── Active-link helper ────────────────────────────────────────────────────
  const isActive = (href: string) =>
    href === projectPath
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  // ── Static nav items ──────────────────────────────────────────────────────
  const workspaceStaticItems = [
    { title: "Board", href: projectPath, icon: LayoutDashboardIcon },
    {
      title: "Sprints",
      href: `${projectPath}/sprints`,
      icon: CalendarDaysIcon,
    },
  ];

  const manageItems = [
    {
      title: "Project settings",
      href: `${projectPath}/settings/project`,
      icon: SettingsIcon,
    },
    {
      title: "Manage members",
      href: `${projectPath}/settings/members`,
      icon: UserCogIcon,
    },
    { title: "Metrics", href: `${projectPath}/metrics`, icon: BarChart3Icon },
  ];
  const defaultBoard =
    workspaceViews.find((view) => view.name === "Board") ??
    workspaceViews.find((view) => {
      const row =
        view.configuration.grouping?.row !== undefined
          ? view.configuration.grouping.row
          : view.configuration.rowSplit !== undefined
            ? view.configuration.rowSplit
            : view.configuration.rowGroup;
      return row !== "assignee";
    }) ??
    workspaceViews[0];

  useEffect(() => {
    if (membershipError) toast.error(membershipError.message);
    if (viewsError) toast.error(viewsError.message);
  }, [membershipError, viewsError]);

  const openCreateView = (scope: "personal" | "workspace") => {
    setNewScope(scope);
    setCreateOpen(true);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <ProjectSwitcher projectId={projectId} />
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label="Main navigation">
            {/* ── Workspace ────────────────────────────────────────────── */}
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workspaceStaticItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={
                          isActive(item.href) ||
                          (item.title === "Board" &&
                            pathname ===
                              `${projectPath}/views/${defaultBoard?.id}`)
                        }
                        aria-current={
                          isActive(item.href) ||
                          (item.title === "Board" &&
                            pathname ===
                              `${projectPath}/views/${defaultBoard?.id}`)
                            ? "page"
                            : undefined
                        }
                        onClick={() => setOpenMobile(false)}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* ── Workspace Views ───────────────────────────────────────── */}
            <SidebarGroup>
              <SidebarGroupLabel>Workspace Views</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workspaceViews.map((view) => {
                    const href = `${projectPath}/views/${view.id}`;
                    return (
                      <SidebarMenuItem key={view.id}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          isActive={isActive(href)}
                          aria-current={isActive(href) ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        >
                          <ViewIcon icon={view.icon} />
                          <span>{view.name}</span>
                        </SidebarMenuButton>
                        {/* Only managers can edit workspace views */}
                        {isManager && (
                          <SidebarMenuAction
                            aria-label={`Edit ${view.name}`}
                            onClick={() => router.push(`${href}?edit=1`)}
                          >
                            <PencilIcon className="h-3 w-3" />
                          </SidebarMenuAction>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* ── My Views ──────────────────────────────────────────────── */}
            <SidebarGroup>
              <SidebarGroupLabel>My Views</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {myViews.map((view) => {
                    const href = `${projectPath}/views/${view.id}`;
                    return (
                      <SidebarMenuItem key={view.id}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          isActive={isActive(href)}
                          aria-current={isActive(href) ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        >
                          <ViewIcon icon={view.icon} />
                          <span>{view.name}</span>
                        </SidebarMenuButton>
                        {/* Owners can always edit their own views */}
                        <SidebarMenuAction
                          aria-label={`Edit ${view.name}`}
                          onClick={() => router.push(`${href}?edit=1`)}
                        >
                          <PencilIcon className="h-3 w-3" />
                        </SidebarMenuAction>
                      </SidebarMenuItem>
                    );
                  })}

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => openCreateView("personal")}
                      className="text-muted-foreground"
                    >
                      <PlusIcon aria-hidden="true" />
                      <span>Add personal view</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        type="button"
                        onClick={() => openCreateView("workspace")}
                        className="text-muted-foreground"
                      >
                        <PlusIcon aria-hidden="true" />
                        <span>Add workspace view</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* ── Manage Project ────────────────────────────────────────── */}
            <SidebarGroup>
              <SidebarGroupLabel>Manage Project</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {manageItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive(item.href)}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        onClick={() => setOpenMobile(false)}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>

        <SidebarFooter className="min-h-16" />
      </Sidebar>

      {/* ── Create View Dialog ──────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New View</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <Input
              placeholder="View name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateView();
              }}
              autoFocus
            />
            {isManager && (
              <label className="grid gap-2 text-sm font-medium">
                Location
                <select
                  className="bg-background h-9 rounded-md border px-2"
                  value={newScope}
                  onChange={(event) =>
                    setNewScope(
                      event.target.value === "workspace"
                        ? "workspace"
                        : "personal",
                    )
                  }
                >
                  <option value="personal">My Views</option>
                  <option value="workspace">Workspace Views</option>
                </select>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateView}
              disabled={createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
