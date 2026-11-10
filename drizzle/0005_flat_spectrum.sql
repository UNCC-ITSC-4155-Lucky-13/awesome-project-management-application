CREATE TABLE "story" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"projectId" uuid NOT NULL,
	"creatorId" text NOT NULL,
	"column" varchar(50) DEFAULT 'backlog' NOT NULL,
	"sprintNumber" varchar(8),
	"storyPoints" integer DEFAULT 0,
	"lastMovedAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "story_assignees" (
	"storyId" uuid NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "story_assignee_pk" PRIMARY KEY("storyId","userId")
);
--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_assignees" ADD CONSTRAINT "story_assignees_storyId_story_id_fk" FOREIGN KEY ("storyId") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_assignees" ADD CONSTRAINT "story_assignees_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_project_idx" ON "story" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "story_creator_idx" ON "story" USING btree ("creatorId");--> statement-breakpoint
CREATE INDEX "story_assignee_user_idx" ON "story_assignees" USING btree ("userId");