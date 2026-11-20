CREATE TABLE "sprint_schedule_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"durationWeeks" integer,
	"previousSprintStartDate" timestamp with time zone,
	CONSTRAINT "sprint_schedule_project_start_unique" UNIQUE("projectId","startDate")
);
--> statement-breakpoint
ALTER TABLE "sprint_schedule_change" ADD CONSTRAINT "sprint_schedule_change_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "sprint_schedule_change" ("projectId", "startDate", "durationWeeks")
SELECT "id", "sprintStartDate", "sprintDuration" FROM "project" WHERE "sprintStartDate" IS NOT NULL;
--> statement-breakpoint
UPDATE "story" SET "sprintNumber" = NULL
WHERE "sprintNumber" IS NOT NULL AND "projectId" IN (SELECT "id" FROM "project" WHERE "sprintStartDate" IS NULL);
