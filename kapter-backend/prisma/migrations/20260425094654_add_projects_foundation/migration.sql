-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "notionProjectPageId" TEXT,
    "notionTaskDatabaseId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContext" (
    "id" TEXT NOT NULL,
    "initialDescription" TEXT,
    "contextMarkdown" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContext_pkey" PRIMARY KEY ("id")
);

  -- AlterTable
  ALTER TABLE "Meeting" ADD COLUMN     "projectId" TEXT;

  -- Backfill one draft project per pre-existing meeting so the new required
  -- ownership column can be enforced safely on non-empty databases.
  INSERT INTO "Project" (
    "id",
    "title",
    "description",
    "isDraft",
    "userId",
    "createdAt",
    "updatedAt"
  )
  SELECT
    'project_backfill_' || "Meeting"."id",
    COALESCE(NULLIF(BTRIM("Meeting"."title"), ''), 'Draft Project ' || "Meeting"."id"),
    NULL,
    true,
    "Meeting"."userId",
    "Meeting"."createdAt",
    "Meeting"."updatedAt"
  FROM "Meeting";

  UPDATE "Meeting"
  SET "projectId" = 'project_backfill_' || "id"
  WHERE "projectId" IS NULL;

  ALTER TABLE "Meeting" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContext_projectId_key" ON "ProjectContext"("projectId");

-- CreateIndex
CREATE INDEX "Meeting_projectId_createdAt_idx" ON "Meeting"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContext" ADD CONSTRAINT "ProjectContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
