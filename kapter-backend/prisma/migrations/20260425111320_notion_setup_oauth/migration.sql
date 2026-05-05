-- CreateEnum
CREATE TYPE "NotionProjectDestinationMode" AS ENUM ('PROJECT_PAGE', 'EXISTING_PAGE');

-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_projectId_fkey";

-- AlterTable
ALTER TABLE "Meeting" ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "notionDestinationMode" "NotionProjectDestinationMode";

-- CreateTable
CREATE TABLE "NotionConnection" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "workspaceId" TEXT NOT NULL,
    "workspaceName" TEXT,
    "workspaceIcon" TEXT,
    "ownerUserId" TEXT,
    "ownerUserName" TEXT,
    "ownerUserEmail" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotionConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotionConnection_botId_key" ON "NotionConnection"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "NotionConnection_userId_key" ON "NotionConnection"("userId");

-- CreateIndex
CREATE INDEX "NotionConnection_workspaceId_idx" ON "NotionConnection"("workspaceId");

-- AddForeignKey
ALTER TABLE "NotionConnection" ADD CONSTRAINT "NotionConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
