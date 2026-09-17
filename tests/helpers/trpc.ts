import { afterAll, beforeAll, beforeEach } from "vitest";
import { is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createCaller } from "@/server/api/root";
import type { Session } from "@/server/better-auth/config";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

export { db };

const now = new Date("2026-01-01T00:00:00Z");
export const testSession: Session = {
  user: {
    id: "test-user",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
  },
  session: {
    id: "test-session",
    userId: "test-user",
    token: "test-token",
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
  },
};

// Importing this helper installs the database lifecycle for a router test file.
beforeAll(async () => {
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    const target = new URL(process.env.DATABASE_URL!);
    throw new Error(
      `Cannot connect to the test database at ${target.hostname}:${target.port || "5432"}${target.pathname}. ` +
        "Check that PostgreSQL is running and reachable from your host. " +
        "Tests use DATABASE_TEST_URL, falling back to DATABASE_URL. See .env.example.",
    );
  }
  await migrate(db, { migrationsFolder: "./drizzle" });
}, 30_000);

beforeEach(async () => {
  const tables = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => sql`${table}`);
  await db.execute(
    sql`TRUNCATE TABLE ${sql.join(tables, sql`, `)} RESTART IDENTITY CASCADE`,
  );
  await db.insert(schema.user).values(testSession.user);
  await db.insert(schema.session).values(testSession.session);
});

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

export function createTestCaller(session: Session | null = testSession) {
  return createCaller({ db, session, headers: new Headers() });
}
