import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Typography } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="container mx-auto flex min-h-svh max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <Typography variant="h1">Awesome project management</Typography>
      <Typography variant="subtitle">
        A shared place to organize your team&apos;s work and keep projects
        moving.
      </Typography>
      {/* Temporary destination until project selection is connected. */}
      <Button nativeButton={false} render={<Link href="/project/demo" />}>
        Get started <ArrowRightIcon />
      </Button>
    </main>
  );
}
