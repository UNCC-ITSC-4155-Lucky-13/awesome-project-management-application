import Link from "next/link";
import { redirect } from "next/navigation";

import { Typography } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/server/better-auth/server";
import { api } from "@/trpc/server";

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/projects")}`);
  }

  const projects = await api.project.list();

  return (
    <main className="container mx-auto flex min-h-svh max-w-4xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Typography variant="h1">Choose a project</Typography>
        <Button nativeButton={false} render={<Link href="/projects/create" />}>
          Create project
        </Button>
      </header>

      {projects.length === 0 ? (
        <section className="flex flex-col items-start gap-4">
          <Typography variant="h2">No projects yet</Typography>
          <Typography variant="p">
            Create a project to start organizing your team&apos;s work.
          </Typography>
          <Button
            nativeButton={false}
            render={<Link href="/projects/create" />}
          >
            Create your first project
          </Button>
        </section>
      ) : (
        <section aria-label="Projects" className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${encodeURIComponent(project.id)}`}
              className="group focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="group-hover:border-primary h-full transition-colors">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  {project.description && (
                    <Typography variant="caption">
                      {project.description}
                    </Typography>
                  )}
                </CardHeader>
                <CardFooter className="text-muted-foreground text-sm">
                  Open project
                </CardFooter>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
