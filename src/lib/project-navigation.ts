export const PROJECT_SELECTION_PATH = "/projects";
export const PROJECT_CREATE_PATH = "/projects/create";

/** The default view of a project. */
export function projectHref(projectId: string) {
  return `/project/${encodeURIComponent(projectId)}`;
}

/** Where to send a user whose current project is unavailable. */
export function recoveryPath(projects: readonly unknown[]) {
  return projects.length === 0 ? PROJECT_CREATE_PATH : PROJECT_SELECTION_PATH;
}
