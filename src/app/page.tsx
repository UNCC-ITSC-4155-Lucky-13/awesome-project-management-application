import { headers } from "next/headers";
import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LatestPost } from "@/app/_components/post";
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
import { api, HydrateClient } from "@/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await getSession();

  if (session) {
    void api.post.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-12 px-4 py-16">
        <Typography variant="h1">Create T3 App</Typography>
        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex-1">
              <CardTitle>First Steps</CardTitle>
              <CardDescription>
                Just the basics. Everything you need to know to set up your
                database and authentication.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href="https://create.t3.gg/en/usage/first-steps"
                    target="_blank"
                  />
                }
              >
                Read the guide <ArrowUpRightIcon />
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="flex-1">
              <CardTitle>Documentation</CardTitle>
              <CardDescription>
                Learn more about Create T3 App, the libraries it uses, and how
                to deploy it.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href="https://create.t3.gg/en/introduction"
                    target="_blank"
                  />
                }
              >
                View documentation <ArrowUpRightIcon />
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Typography variant="lead">
            {hello ? hello.greeting : "Loading tRPC query..."}
          </Typography>

          <div className="flex flex-col items-center justify-center gap-4">
            {session && (
              <Typography variant="lead">
                Logged in as {session.user?.name}
              </Typography>
            )}
            {!session ? (
              <form
                action={async () => {
                  "use server";
                  const res = await auth.api.signInSocial({
                    body: {
                      provider: "github",
                      callbackURL: "/",
                    },
                  });
                  if (!res.url) {
                    throw new Error("No URL returned from signInSocial");
                  }
                  redirect(res.url);
                }}
              >
                <Button type="submit">Sign in with GitHub</Button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await auth.api.signOut({
                    headers: await headers(),
                  });
                  redirect("/");
                }}
              >
                <Button type="submit">Sign out</Button>
              </form>
            )}
          </div>
        </div>

        {session?.user && <LatestPost />}
      </main>
    </HydrateClient>
  );
}
