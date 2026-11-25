import { and, eq, isNull } from "drizzle-orm";

import type { db } from "@/server/db";
import { views, type ViewConfiguration } from "@/server/db/schema";

type Database = Pick<typeof db, "query" | "insert">;

export const DEFAULT_BOARD_VIEW: {
  name: string;
  icon: string;
  configuration: ViewConfiguration;
} = {
  name: "Board",
  icon: "layout-dashboard",
  configuration: {
    columns: ["backlog", "todo", "in_progress", "done"],
    groupBy: "status",
    rowGroup: null,
    filters: {},
    sort: null,
  },
};

export const DEFAULT_PERSON_VIEW: {
  name: string;
  icon: string;
  configuration: ViewConfiguration;
} = {
  name: "By person",
  icon: "users",
  configuration: {
    columns: ["backlog", "todo", "in_progress", "done"],
    groupBy: "status",
    rowGroup: "assignee",
    filters: {},
    sort: null,
  },
};

export async function ensureDefaultViews(
  database: Database,
  projectId: string,
): Promise<void> {
  const existingViews = await database.query.views.findMany({
    where: and(eq(views.projectId, projectId), isNull(views.ownerUserId)),
  });

  const toInsert: (typeof views.$inferInsert)[] = [];

  if (!existingViews.some((view) => view.name === DEFAULT_BOARD_VIEW.name)) {
    toInsert.push({
      projectId,
      ownerUserId: null,
      name: DEFAULT_BOARD_VIEW.name,
      icon: DEFAULT_BOARD_VIEW.icon,
      configuration: DEFAULT_BOARD_VIEW.configuration,
    });
  }

  if (!existingViews.some((view) => view.name === DEFAULT_PERSON_VIEW.name)) {
    toInsert.push({
      projectId,
      ownerUserId: null,
      name: DEFAULT_PERSON_VIEW.name,
      icon: DEFAULT_PERSON_VIEW.icon,
      configuration: DEFAULT_PERSON_VIEW.configuration,
    });
  }

  if (toInsert.length > 0) {
    await database.insert(views).values(toInsert);
  }
}
