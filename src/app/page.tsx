import Link from "next/link";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  CheckIcon,
  KanbanSquareIcon,
  SparklesIcon,
} from "lucide-react";

import { Typography } from "@/app/_components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const boardColumns = [
  {
    title: "To do",
    color: "bg-sky-400",
    cards: ["Research user needs", "Outline sprint goals"],
  },
  {
    title: "In progress",
    color: "bg-amber-400",
    cards: ["Design onboarding flow", "Review API changes"],
  },
  {
    title: "Done",
    color: "bg-emerald-400",
    cards: ["Set up workspace", "Connect GitHub"],
  },
];

export default function Home() {
  return (
    <main className="bg-background min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_50%_-20%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_65%)]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link
          href="/"
          className="font-heading flex items-center gap-2 text-lg font-semibold tracking-tight"
          aria-label="BetterJira home"
        >
          <span className="bg-primary text-primary-foreground shadow-primary/20 flex size-8 items-center justify-center rounded-lg shadow-lg">
            <KanbanSquareIcon className="size-4" aria-hidden="true" />
          </span>
          BetterJira
        </Link>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/login" />}
          className="text-muted-foreground hover:text-foreground"
        >
          Sign in
        </Button>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-6 pt-14 pb-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pt-24 lg:pb-28">
        <div className="max-w-xl">
          <Badge
            variant="secondary"
            className="mb-6 gap-2 rounded-full px-3 py-1"
          >
            <SparklesIcon
              className="text-primary size-3.5"
              aria-hidden="true"
            />
            A calmer way to ship great work
          </Badge>
          <Typography
            variant="h1"
            className="text-5xl leading-[1.05] text-balance sm:text-6xl lg:text-7xl"
          >
            Make progress visible.
          </Typography>
          <Typography
            variant="lead"
            className="text-muted-foreground mt-6 max-w-lg text-lg leading-8 sm:text-xl"
          >
            BetterJira brings tasks, sprints, and team momentum into one clear
            workspace—so everyone knows what matters next.
          </Typography>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/login" />}
              className="shadow-primary/20 gap-2 shadow-lg"
            >
              Get started free
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="#preview" />}
            >
              See how it works
            </Button>
          </div>
          <div className="text-muted-foreground mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {["Simple by design", "Built for teams", "No busywork"].map(
              (item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckIcon
                    className="text-primary size-4"
                    aria-hidden="true"
                  />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>

        <div id="preview" className="relative min-w-0">
          <div className="bg-primary/10 absolute -inset-8 rounded-[3rem] blur-3xl" />
          <Card className="bg-card/90 relative overflow-hidden border-white/10 p-2 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="border-border/70 flex items-center gap-2 border-b px-4 py-3">
              <span className="size-2.5 rounded-full bg-red-400/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
              <span className="text-muted-foreground ml-3 text-xs">
                Product workspace
              </span>
            </div>
            <div className="grid min-h-[25rem] grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr]">
              <aside className="border-border/70 bg-muted/20 border-r p-3">
                <div className="mb-7 flex items-center gap-2 text-xs font-medium">
                  <span className="bg-primary/80 size-5 rounded" />
                  Acme team
                </div>
                <div className="text-muted-foreground space-y-2 text-[11px]">
                  <div className="bg-primary/15 text-primary rounded-md px-2 py-1.5">
                    Board
                  </div>
                  <div className="px-2 py-1.5">Sprints</div>
                  <div className="px-2 py-1.5">Metrics</div>
                </div>
              </aside>
              <div className="min-w-0 p-4 sm:p-6">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-base font-semibold">
                      Product launch
                    </p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      Sprint 12 · 8 issues
                    </p>
                  </div>
                  <span className="border-border text-muted-foreground rounded-md border px-2 py-1 text-[10px]">
                    This week
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {boardColumns.map((column) => (
                    <div
                      key={column.title}
                      className="bg-muted/35 min-w-0 rounded-lg p-2"
                    >
                      <div className="mb-3 flex items-center justify-between px-1">
                        <span className="text-[11px] font-medium">
                          {column.title}
                        </span>
                        <span
                          className={`size-1.5 rounded-full ${column.color}`}
                        />
                      </div>
                      <div className="space-y-2">
                        {column.cards.map((card, index) => (
                          <div
                            key={card}
                            className="border-border/70 bg-card rounded-md border p-2.5 shadow-sm"
                          >
                            <p className="text-[10px] leading-4">{card}</p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-muted-foreground text-[9px]">
                                TASK-{index + 24}
                              </span>
                              <span className="bg-primary/25 size-4 rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-border/60 bg-muted/20 relative z-10 border-y">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:grid-cols-3 lg:px-8">
          <Feature
            icon={KanbanSquareIcon}
            title="One clear board"
            description="See every task, owner, and next step at a glance."
          />
          <Feature
            icon={CalendarDaysIcon}
            title="Focused sprints"
            description="Keep planning lightweight and momentum high."
          />
          <Feature
            icon={BarChart3Icon}
            title="Useful metrics"
            description="Understand progress without digging through noise."
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
        <Typography variant="h2" className="text-3xl text-balance sm:text-4xl">
          Your team has enough to keep track of.
        </Typography>
        <Typography
          variant="subtitle"
          className="mx-auto mt-4 max-w-xl leading-7"
        >
          Start with a workspace that makes the work feel a little easier.
        </Typography>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/login" />}
          className="mt-8 gap-2"
        >
          Create your workspace
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof KanbanSquareIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <Typography variant="h4" className="text-base">
          {title}
        </Typography>
        <Typography variant="caption" className="mt-1 block leading-5">
          {description}
        </Typography>
      </div>
    </div>
  );
}
