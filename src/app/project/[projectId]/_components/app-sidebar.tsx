"use client";

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import {
  BarChart3Icon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SettingsIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ProjectSwitcher } from "./project-switcher";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AppSidebar() {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId: string }>();
  const projectPath = `/project/${encodeURIComponent(projectId)}`;
  const { setOpenMobile } = useSidebar();

  const utils = api.useContext();

  // Dialog state for creating a new view
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreateView = async () => {
    if (!newName) {
      toast.error("View name cannot be empty");
      return;
    }
    try {
      await api.view.create.mutateAsync({
        projectId,
        name: newName,
        icon: "layout-dashboard",
        configuration: {},
      });
      toast.success("View created");
      void utils.view.list.invalidate({ projectId });
      setCreateOpen(false);
      setNewName("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create view");
    }
  };

  const groups = [
    {
      label: "Workspace",
      items: [
        { title: "Board", href: "/", icon: LayoutDashboardIcon },
        { title: "Sprints", href: "/sprints", icon: CalendarDaysIcon },
        { title: "Metrics", href: "/metrics", icon: BarChart3Icon },
      ],
    },
    {
      // TODO: eventually load from DB via api.view.list
      label: "Views",
      items: [
        { title: "By person", href: "/views/person", icon: UsersIcon },
        { title: "Create View", action: () => setCreateOpen(true), icon: PlusIcon },
      ],
    },
    {
      label: "Manage Project",
      items: [
        { title: "Project settings", href: "/settings/project", icon: SettingsIcon },
        { title: "Manage members", href: "/settings/members", icon: UserCogIcon },
      ],
    },
  ];

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <ProjectSwitcher projectId={projectId} />
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Main navigation">
            {groups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      if ("action" in item) {
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              type="button"
                              onClick={item.action}
                              className="text-muted-foreground"
                            >
                              <item.icon aria-hidden="true" />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      }
                      const href =
                        item.href === "/" ? projectPath : `${projectPath}${item.href}`;
                      const active =
                        pathname === href || (item.href !== "/" && pathname.startsWith(`${href}/`));
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            render={<Link href={href} />}
                            isActive={active}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setOpenMobile(false)}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter className="min-h-16" />
      </Sidebar>

      {/* Create View Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          {/* The trigger is the Create View button handled via action above, so we render nothing here */}
          <span />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="View name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateView}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
