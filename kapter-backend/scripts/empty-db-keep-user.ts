import * as dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/prisma/client";

type SchemaRow = {
  current_schema: string | null;
};

type TableRow = {
  table_name: string;
};

const quoteIdentifier = (value: string): string =>
  `"${value.replace(/"/g, '""')}"`;

const getAdminDatabaseUrl = (): string | undefined =>
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

const loadEnvironment = (): void => {
  dotenv.config({ path: ".env" });

  if (!getAdminDatabaseUrl()) {
    dotenv.config({ path: "kapter-backend/.env" });
  }

  if (!getAdminDatabaseUrl()) {
    throw new Error(
      "DIRECT_URL or DATABASE_URL must be set. Configure them in kapter-backend/.env or export them before running the script.",
    );
  }
};

const main = async (): Promise<void> => {
  loadEnvironment();

  const adapter = new PrismaPg({
    connectionString: getAdminDatabaseUrl()!,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const [schemaRow] = await prisma.$queryRaw<SchemaRow[]>`
      SELECT current_schema() AS current_schema
    `;
    const schema = schemaRow?.current_schema ?? "public";

    const tablesToTruncate = await prisma.$queryRaw<TableRow[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schema}
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('User', '_prisma_migrations')
      ORDER BY table_name ASC
    `;

    if (tablesToTruncate.length === 0) {
      console.log(
        `No tables to truncate in schema "${schema}". "User" and "_prisma_migrations" were preserved.`,
      );
      return;
    }

    const qualifiedTables = tablesToTruncate
      .map((row) => `${quoteIdentifier(schema)}.${quoteIdentifier(row.table_name)}`)
      .join(", ");

    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`,
    );

    console.log(
      `Truncated ${tablesToTruncate.length} table(s) in schema "${schema}" while preserving "User" and "_prisma_migrations".`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error("Database reset failed:", error);
  process.exitCode = 1;
});
