"use client";

import { useState } from "react";

import { Typography } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

export function LatestPost() {
  const [latestPost] = api.post.getLatest.useSuspenseQuery();

  const utils = api.useUtils();
  const [name, setName] = useState("");
  const createPost = api.post.create.useMutation({
    onSuccess: async () => {
      await utils.post.invalidate();
      setName("");
    },
  });

  return (
    <div className="w-full max-w-xs">
      {latestPost ? (
        <Typography>Your most recent post: {latestPost.name}</Typography>
      ) : (
        <Typography>You have no posts yet.</Typography>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({ name });
        }}
        className="flex flex-col gap-2"
      >
        <Input
          type="text"
          placeholder="Title"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={createPost.isPending}>
          {createPost.isPending ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </div>
  );
}
