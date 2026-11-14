import "dotenv/config";

const port = Number(process.env.API_PORT ?? 4000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT must be an integer between 1 and 65535.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required.");
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port,
};
