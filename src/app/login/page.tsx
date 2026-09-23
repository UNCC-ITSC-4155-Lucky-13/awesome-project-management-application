import Link from "next/link";
import { redirect } from "next/navigation";

import { Typography } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/server/better-auth";
import { getSession } from "@/server/better-auth/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const destination = callbackUrl ?? "/dashboard";

  // If the user is already signed in, send them where they wanted to go.
  const session = await getSession();
  if (session) {
    redirect(destination);
  }

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
      <Typography variant="h1">Sign in required</Typography>
      <Typography variant="subtitle">
        You must be signed in to access this page.
      </Typography>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to your account</CardTitle>
          <CardDescription>
            We use GitHub for authentication. No password needed.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-3">
          <form
            action={async () => {
              "use server";
              const res = await auth.api.signInSocial({
                body: {
                  provider: "github",
                  callbackURL: destination,
                },
              });
              if (!res.url) {
                throw new Error("No URL returned from signInSocial");
              }
              redirect(res.url);
            }}
            className="w-full"
          >
            <Button type="submit" className="w-full">
              Sign in with GitHub
            </Button>
          </form>

          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/" />}
            className="w-full"
          >
            Back to home
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
