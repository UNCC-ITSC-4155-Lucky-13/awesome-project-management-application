import { Typography } from "@/app/_components/typography";

import { ProjectSelection } from "./_components/project-selection";

export default function ProjectsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <Typography variant="caption">BetterJira</Typography>
        {/* Top-right slot for the notification menu. */}
      </header>
      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-12">
        <Typography variant="h2">Select a project</Typography>
        <ProjectSelection />
      </main>
    </div>
  );
}
