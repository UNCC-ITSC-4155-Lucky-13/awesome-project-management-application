import { inviteRouter } from "@/server/api/routers/invite";
import { userRouter } from "@/server/api/routers/user";
import { postRouter } from "@/server/api/routers/post";
import { projectRouter } from "@/server/api/routers/project";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { storyRouter } from "./routers/story";
import { memberRouter } from "@/server/api/routers/member";
import { commentRouter } from "@/server/api/routers/comment";


/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  user: userRouter,
  invite: inviteRouter,
  project: projectRouter,
  story: storyRouter,
  member: memberRouter,
  comment: commentRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
