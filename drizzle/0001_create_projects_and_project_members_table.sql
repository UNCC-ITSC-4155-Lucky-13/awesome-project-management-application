CREATE TYPE "public"."project_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "project_member" (
	"projectId" uuid NOT NULL,
	"userId" text NOT NULL,
	"role" "project_role" DEFAULT 'member' NOT NULL,
	CONSTRAINT "project_member_pk" PRIMARY KEY("projectId","userId")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sprintsEnabled" boolean DEFAULT false NOT NULL,
	"sprintDuration" integer DEFAULT 2 NOT NULL,
	"sprintStartDate" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_member_user_id_idx" ON "project_member" USING btree ("userId");