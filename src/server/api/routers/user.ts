import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { userPreferences, userTheme } from "@/server/db/schema";

const preferencesOutput = (
  preferences: typeof userPreferences.$inferSelect,
) => ({
  theme: preferences.theme,
});

export const userRouter = createTRPCRouter({
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const existingPreferences = await ctx.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, ctx.session.user.id),
    });

    if (existingPreferences) {
      return preferencesOutput(existingPreferences);
    }

    const [createdPreferences] = await ctx.db
      .insert(userPreferences)
      .values({ userId: ctx.session.user.id })
      .returning();

    return preferencesOutput(createdPreferences!);
  }),

  updatePreferences: protectedProcedure
    .input(
      z
        .object({
          theme: z.enum(userTheme.enumValues).optional(),
        })
        .refine((preferences) => preferences.theme !== undefined, {
          message: "At least one preference must be supplied",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedPreferences] = await ctx.db
        .insert(userPreferences)
        .values({
          userId: ctx.session.user.id,
          theme: input.theme,
        })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: {
            theme: input.theme,
            updatedAt: new Date(),
          },
        })
        .returning();

      return preferencesOutput(updatedPreferences!);
    }),
});
