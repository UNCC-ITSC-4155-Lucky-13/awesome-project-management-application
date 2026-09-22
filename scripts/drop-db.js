import postgres from "postgres";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to drop the database when NODE_ENV is production.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");
} finally {
  await sql.end();
}
