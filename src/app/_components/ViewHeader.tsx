"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { toast } from "@/components/ui/use-toast";
import { Typography } from "@/app/_components/typography";
import { ViewIcon, SUPPORTED_VIEW_ICON_KEYS } from "@/app/_components/ViewIcon";
import type { ViewConfiguration, ViewIssueField } from "@/server/db/schema";
import { PencilIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS_COLUMNS = [
  ["backlog", "Backlog"],
  ["todo", "To Do"],
  ["in_progress", "In Progress"],
  ["done", "Done"],
] as const;
const SORT_FIELDS = ["createdAt", "lastMovedAt", "storyPoints"] as const;
type SortField = (typeof SORT_FIELDS)[number];
const SORT_LABELS: Record<SortField, string> = {
  createdAt: "Created",
  lastMovedAt: "Last moved",
  storyPoints: "Story points",
};
type ViewIconKey = (typeof SUPPORTED_VIEW_ICON_KEYS)[number];
type ViewScope = "workspace" | "personal";

function isViewIconKey(value: string): value is ViewIconKey {
  return SUPPORTED_VIEW_ICON_KEYS.some((key) => key === value);
}

function sortValues(configuration: ViewConfiguration) {
  if (!configuration.sort) {
    return { field: "", direction: "desc" as const };
  }
  if (typeof configuration.sort === "string") {
    return { field: configuration.sort, direction: "desc" as const };
  }
  return {
    field: configuration.sort.field,
    direction: configuration.sort.direction ?? "desc",
  };
}

export function ViewHeader({
  viewId,
  projectId,
  initialName,
  initialIcon,
  initialConfiguration,
  ownerUserId,
}: {
  viewId: string;
  projectId: string;
  initialName: string;
  initialIcon: string;
  initialConfiguration: ViewConfiguration;
  ownerUserId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utils = api.useContext();
  const { data: me } = api.user.me.useQuery();
  const { data: members = [] } = api.member.list.useQuery({ projectId });
  const myMembership = members.find((member) => member.userId === me?.id);
  const canManageWorkspace =
    myMembership?.role === "admin" || myMembership?.role === "owner";
  const isWorkspaceView = ownerUserId === null;
  const canEdit = !isWorkspaceView || canManageWorkspace;

  const [displayName, setDisplayName] = useState(initialName);
  const [displayIcon, setDisplayIcon] = useState(initialIcon);
  const [savedConfiguration, setSavedConfiguration] =
    useState(initialConfiguration);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(initialName);
  const [draftIcon, setDraftIcon] = useState<ViewIconKey>(
    isViewIconKey(initialIcon) ? initialIcon : "layout-dashboard",
  );
  const [draftConfiguration, setDraftConfiguration] =
    useState(initialConfiguration);
  const [draftScope, setDraftScope] = useState<ViewScope>(
    isWorkspaceView ? "workspace" : "personal",
  );

  useEffect(() => {
    if (searchParams.get("edit") === "1" && canEdit) {
      setEditing(true);
    }
  }, [canEdit, searchParams]);

  const updateMutation = api.view.update.useMutation({
    onSuccess: (updated) => {
      setDisplayName(updated.name);
      setDisplayIcon(updated.icon);
      setDraftName(updated.name);
      setDraftIcon(
        isViewIconKey(updated.icon) ? updated.icon : "layout-dashboard",
      );
      setDraftConfiguration(updated.configuration);
      setSavedConfiguration(updated.configuration);
      setDraftScope(updated.ownerUserId === null ? "workspace" : "personal");
      void utils.view.getById.invalidate({ projectId, id: viewId });
      void utils.view.list.invalidate({ projectId });
      toast.success("View updated");
      setEditing(false);
      if (searchParams.has("edit")) router.replace(pathname);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.view.delete.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ projectId });
      toast.success("View deleted");
      router.push(`/project/${encodeURIComponent(projectId)}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const openEdit = () => {
    setDraftName(displayName);
    setDraftIcon(isViewIconKey(displayIcon) ? displayIcon : "layout-dashboard");
    setDraftConfiguration(savedConfiguration);
    setDraftScope(isWorkspaceView ? "workspace" : "personal");
    setEditing(true);
  };

  const updateConfiguration = (
    update: (configuration: ViewConfiguration) => ViewConfiguration,
  ) => setDraftConfiguration((configuration) => update(configuration));

  const handleUpdate = () => {
    if (!draftName.trim()) {
      toast.error("View name cannot be empty");
      return;
    }
    if (
      selectedGroup === "status" &&
      (draftConfiguration.columns?.length ?? 0) === 0
    ) {
      toast.error("Select at least one status column");
      return;
    }

    updateMutation.mutate({
      id: viewId,
      projectId,
      name: draftName.trim(),
      icon: draftIcon,
      configuration: draftConfiguration,
      scope: draftScope,
      ownerUserId: draftScope === "workspace" ? null : me?.id,
    });
  };

  const handleDelete = () => {
    if (window.confirm("Delete this view? This action cannot be undone.")) {
      deleteMutation.mutate({ id: viewId, projectId });
    }
  };

  const sort = sortValues(draftConfiguration);
  const selectedRowSplit =
    draftConfiguration.grouping?.row !== undefined
      ? draftConfiguration.grouping.row
      : draftConfiguration.rowSplit !== undefined
        ? draftConfiguration.rowSplit
        : (draftConfiguration.rowGroup ?? null);
  const selectedGroup =
    draftConfiguration.grouping?.column ??
    draftConfiguration.groupBy ??
    "status";

  return (
    <div className="bg-muted/30 flex items-center justify-between border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <ViewIcon icon={displayIcon} className="size-5 shrink-0" />
        <Typography variant="h2" className="truncate">
          {displayName}
        </Typography>
      </div>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={openEdit}
          aria-label="Edit view"
        >
          <PencilIcon aria-hidden="true" />
          <span>Edit</span>
        </Button>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit View</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-medium">
              Name
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Icon
              <select
                className="bg-background h-9 rounded-md border px-2"
                value={draftIcon}
                onChange={(event) => {
                  if (isViewIconKey(event.target.value)) {
                    setDraftIcon(event.target.value);
                  }
                }}
              >
                {SUPPORTED_VIEW_ICON_KEYS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>

            {canManageWorkspace && (
              <label className="grid gap-2 text-sm font-medium">
                Location
                <select
                  className="bg-background h-9 rounded-md border px-2"
                  value={draftScope}
                  onChange={(event) =>
                    setDraftScope(event.target.value as ViewScope)
                  }
                >
                  <option value="personal">My Views</option>
                  <option value="workspace">Workspace Views</option>
                </select>
              </label>
            )}

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Group columns by</legend>
              <select
                className="bg-background h-9 rounded-md border px-2"
                value={selectedGroup}
                onChange={(event) => {
                  const groupBy = event.target.value as ViewIssueField;
                  updateConfiguration((configuration) => ({
                    ...configuration,
                    groupBy,
                    grouping: {
                      ...configuration.grouping,
                      column: groupBy,
                    },
                  }));
                }}
              >
                <option value="status">Status</option>
                <option value="assignee">Assignee set</option>
                <option value="sprint">Sprint</option>
              </select>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Status columns</legend>
              <div className="flex flex-wrap gap-3">
                {STATUS_COLUMNS.map(([key, label]) => {
                  const selected =
                    draftConfiguration.columns?.includes(key) ?? true;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          updateConfiguration((configuration) => {
                            const columns = configuration.columns ?? [
                              ...STATUS_COLUMNS.map(([status]) => status),
                            ];
                            return {
                              ...configuration,
                              columns: event.target.checked
                                ? [...columns, key].filter(
                                    (column, index, list) =>
                                      list.indexOf(column) === index,
                                  )
                                : columns.filter((column) => column !== key),
                            };
                          })
                        }
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">
                Optional row split
              </legend>
              <select
                className="bg-background h-9 rounded-md border px-2"
                value={selectedRowSplit ?? ""}
                onChange={(event) => {
                  const rowSplit = event.target.value
                    ? (event.target.value as ViewIssueField)
                    : null;
                  updateConfiguration((configuration) => ({
                    ...configuration,
                    rowSplit,
                    rowGroup: rowSplit,
                    grouping: { ...configuration.grouping, row: rowSplit },
                  }));
                }}
              >
                <option value="">None</option>
                <option value="assignee">Assignee set</option>
                <option value="sprint">Sprint</option>
                <option value="status">Status</option>
              </select>
            </fieldset>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Filters</legend>
              <label className="grid gap-1 text-sm">
                Sprint
                <Input
                  value={draftConfiguration.filters?.sprintNumber ?? ""}
                  placeholder="Any sprint"
                  onChange={(event) =>
                    updateConfiguration((configuration) => ({
                      ...configuration,
                      filters: {
                        ...configuration.filters,
                        sprintNumber: event.target.value || null,
                      },
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Assignee
                <select
                  className="bg-background h-9 rounded-md border px-2"
                  value={
                    draftConfiguration.filters?.assigneeId === null
                      ? "__none__"
                      : (draftConfiguration.filters?.assigneeId ?? "")
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    updateConfiguration((configuration) => ({
                      ...configuration,
                      filters: {
                        ...configuration.filters,
                        assigneeId:
                          value === ""
                            ? undefined
                            : value === "__none__"
                              ? null
                              : value,
                      },
                    }));
                  }}
                >
                  <option value="">Any assignee</option>
                  <option value="__none__">No assignee</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Status
                <select
                  className="bg-background h-9 rounded-md border px-2"
                  value={
                    draftConfiguration.filters?.column ??
                    draftConfiguration.filters?.status ??
                    ""
                  }
                  onChange={(event) =>
                    updateConfiguration((configuration) => ({
                      ...configuration,
                      filters: {
                        ...configuration.filters,
                        column: event.target.value || null,
                        status: undefined,
                      },
                    }))
                  }
                >
                  <option value="">Any status</option>
                  {STATUS_COLUMNS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Sort issues by</legend>
              <div className="flex flex-wrap gap-2">
                <select
                  className="bg-background h-9 min-w-40 rounded-md border px-2"
                  value={sort.field}
                  onChange={(event) => {
                    const field = event.target.value as SortField | "";
                    updateConfiguration((configuration) => ({
                      ...configuration,
                      sort: field ? { field, direction: sort.direction } : null,
                    }));
                  }}
                >
                  <option value="">Default order</option>
                  {SORT_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {SORT_LABELS[field]}
                    </option>
                  ))}
                </select>
                {sort.field && (
                  <select
                    className="bg-background h-9 rounded-md border px-2"
                    value={sort.direction}
                    aria-label="Sort direction"
                    onChange={(event) =>
                      updateConfiguration((configuration) => ({
                        ...configuration,
                        sort: {
                          field: sort.field as SortField,
                          direction: event.target.value as "asc" | "desc",
                        },
                      }))
                    }
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                )}
              </div>
            </fieldset>
          </div>

          <DialogFooter className="flex flex-wrap justify-between gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending || !canEdit}
            >
              Delete view
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={
                  updateMutation.isPending ||
                  !draftName.trim() ||
                  (selectedGroup === "status" &&
                    (draftConfiguration.columns?.length ?? 0) === 0)
                }
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
