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
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
    // TODO: this should be from DB
    label: "Views",
    items: [
      { title: "By person", href: "/views/person", icon: UsersIcon },
      { title: "Create View", action: createView, icon: PlusIcon },
    ],
  },
  {
    label: "Manage Project",
    items: [
      {
        title: "Project settings",
        href: "/settings/project",
        icon: SettingsIcon,
      },
      {
        title: "Manage members",
        href: "/settings/members",
        icon: UserCogIcon,
      },
    ],
  },
];

function createView() {
  console.log("createView");
}

export function AppSidebar() {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId: string }>();
  const projectPath = `/project/${encodeURIComponent(projectId)}`;
  const { setOpenMobile } = useSidebar();

  return (
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
                      item.href === "/"
                        ? projectPath
                        : `${projectPath}${item.href}`;
                    const active =
                      pathname === href ||
                      (item.href !== "/" && pathname.startsWith(`${href}/`));
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
  );
}
