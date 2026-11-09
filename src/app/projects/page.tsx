import { Typography } from "@/app/_components/typography";

import { ProjectSelection } from "./_components/project-selection";

export default function ProjectsPage() {
  return (
    <>
      <Typography variant="h2">Select a project</Typography>
      <ProjectSelection />
    </>
  );
}
