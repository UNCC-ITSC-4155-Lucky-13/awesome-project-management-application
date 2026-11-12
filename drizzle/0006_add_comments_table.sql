CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storyId" uuid NOT NULL,
	"createdBy" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"editedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_storyId_story_id_fk" FOREIGN KEY ("storyId") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_story_idx" ON "comment" USING btree ("storyId");