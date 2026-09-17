import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  (env.NODE_ENV === "development" ? globalForDb.conn : undefined) ??
  postgres(
    env.DATABASE_URL,
    env.NODE_ENV === "test" ? { connect_timeout: 5 } : {},
  );
if (env.NODE_ENV === "development") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
