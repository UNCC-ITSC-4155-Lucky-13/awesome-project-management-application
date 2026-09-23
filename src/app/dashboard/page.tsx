import { Typography } from "@/app/_components/typography";

export default function DashboardPage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-4">
      <Typography variant="h1">Dashboard</Typography>
      <Typography variant="subtitle">
        This is a protected page. Only signed-in users can see this.
      </Typography>
    </main>
  );
}
