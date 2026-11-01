CREATE TABLE "project_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"githubUsername" varchar(255) NOT NULL,
	"projectId" uuid NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	CONSTRAINT "project_invites_github_username_project_id_unique" UNIQUE("githubUsername","projectId")
);
--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_invites_github_username_idx" ON "project_invites" USING btree ("githubUsername");--> statement-breakpoint
CREATE INDEX "project_invites_project_id_idx" ON "project_invites" USING btree ("projectId");