import {
  BarChart3Icon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  ListIcon,
  TableIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

export const SUPPORTED_VIEW_ICON_KEYS = [
  "layout-dashboard",
  "board",
  "users",
  "user",
  "person",
  "calendar",
  "calendar-days",
  "bar-chart",
  "bar-chart-3",
  "table",
  "list",
  "kanban",
  "columns",
  "grid",
  "check-square",
  "clock",
  "tag",
  "bookmark",
  "settings",
  "folder",
  "LayoutDashboard",
  "LayoutDashboardIcon",
  "Users",
  "UsersIcon",
  "CalendarDays",
  "CalendarDaysIcon",
  "BarChart3",
  "BarChart3Icon",
] as const;

const icons = {
  "layout-dashboard": LayoutDashboardIcon,
  board: LayoutDashboardIcon,
  users: UsersIcon,
  user: UserIcon,
  person: UserIcon,
  calendar: CalendarDaysIcon,
  "calendar-days": CalendarDaysIcon,
  "bar-chart": BarChart3Icon,
  "bar-chart-3": BarChart3Icon,
  table: TableIcon,
  list: ListIcon,
  kanban: LayoutDashboardIcon,
  columns: LayoutDashboardIcon,
  grid: LayoutDashboardIcon,
  "check-square": ListIcon,
  clock: CalendarDaysIcon,
  tag: ListIcon,
  bookmark: ListIcon,
  settings: LayoutDashboardIcon,
  folder: LayoutDashboardIcon,
  LayoutDashboard: LayoutDashboardIcon,
  LayoutDashboardIcon,
  Users: UsersIcon,
  UsersIcon,
  CalendarDays: CalendarDaysIcon,
  CalendarDaysIcon,
  BarChart3: BarChart3Icon,
  BarChart3Icon,
} as const;

export function ViewIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = icons[icon as keyof typeof icons] ?? LayoutDashboardIcon;
  return <Icon className={className} aria-hidden="true" />;
}
