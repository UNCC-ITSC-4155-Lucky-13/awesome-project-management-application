-- A null start date disables sprints. Keep previously disabled projects disabled.
UPDATE "project" SET "sprintStartDate" = NULL WHERE "sprintsEnabled" = false;
--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "sprintsEnabled";
