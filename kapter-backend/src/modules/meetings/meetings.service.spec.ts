import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";

import { MeetingsService } from "./meetings.service";

const createService = () => {
  const findMany = mock.fn(async (_args: unknown) => [] as unknown[]);
  const findFirst = mock.fn(async (_args: unknown) => null as unknown);
  const findUnique = mock.fn(async (_args: unknown) => null as unknown);
  const create = mock.fn(async (_args: unknown) => undefined as unknown);
  const update = mock.fn(async (_args: unknown) => undefined as unknown);
  const remove = mock.fn(async (_args: unknown) => undefined as unknown);
  const projectFindUnique = mock.fn(async (_args: unknown) => null as unknown);
  const projectCreate = mock.fn(async (_args: unknown) => undefined as unknown);

  const prisma = {
    meeting: {
      findMany,
      findFirst,
      findUnique,
      create,
      update,
      delete: remove,
    },
    project: {
      findUnique: projectFindUnique,
      create: projectCreate,
    },
  };
  const voiceProfilesService = {
    getOwnedVoiceProfileSummary: mock.fn(),
    promoteMeetingSpeakerToVoiceProfile: mock.fn(),
  };

  const service = new MeetingsService(prisma as never, voiceProfilesService as never);

  return {
    service,
    meeting: {
      findMany,
      findFirst,
      findUnique,
      create,
      update,
      delete: remove,
    },
    project: {
      findUnique: projectFindUnique,
      create: projectCreate,
    },
  };
};

afterEach(() => {
  mock.restoreAll();
});

void describe("MeetingsService", () => {
  void it("persists explicit project ownership when creating a recording meeting", async () => {
    const { service, meeting, project } = createService();

    project.findUnique.mock.mockImplementation(async () => ({
      id: "project_1",
      userId: "local_user_1",
    }));

    meeting.create.mock.mockImplementation(async () => ({
      id: "meeting_project_1",
      title: "Recording abc-defg-hij",
      status: "RECORDING",
      ingestionSource: "LIVE_CAPTURE",
      externalMeetingId: "abc-defg-hij",
      userId: "local_user_1",
      projectId: "project_1",
    }));

    const createdMeeting = await service.createRecordingMeeting({
      userId: "local_user_1",
      externalMeetingId: " abc-defg-hij ",
      projectId: "project_1",
    } as never);

    assert.equal(project.findUnique.mock.callCount(), 1);
    assert.deepEqual(project.findUnique.mock.calls[0]?.arguments[0], {
      where: {
        id: "project_1",
      },
      select: {
        id: true,
        userId: true,
      },
    });
    assert.equal(meeting.create.mock.callCount(), 1);
    assert.deepEqual(meeting.create.mock.calls[0]?.arguments[0], {
      data: {
        userId: "local_user_1",
        title: "Recording abc-defg-hij",
        status: "RECORDING",
        ingestionSource: "LIVE_CAPTURE",
        captureContext: undefined,
        externalMeetingId: "abc-defg-hij",
        projectId: "project_1",
      },
      select: {
        id: true,
        externalMeetingId: true,
        status: true,
        title: true,
        userId: true,
        projectId: true,
      },
    });
    assert.deepEqual(createdMeeting, {
      id: "meeting_project_1",
      title: "Recording abc-defg-hij",
      status: "RECORDING",
      ingestionSource: "LIVE_CAPTURE",
      externalMeetingId: "abc-defg-hij",
      userId: "local_user_1",
      projectId: "project_1",
    });
  });

  void it("creates a draft project before creating a recording meeting when no project id is provided", async () => {
    const { service, meeting, project } = createService();

    project.create.mock.mockImplementation(async () => ({
      id: "project_draft_1",
    }));

    meeting.create.mock.mockImplementation(async () => ({
      id: "meeting_project_2",
      title: "Recording 2026-04-25T00:00:00.000Z",
      status: "RECORDING",
      ingestionSource: "LIVE_CAPTURE",
      externalMeetingId: null,
      userId: "local_user_1",
      projectId: "project_draft_1",
    }));

    const createdMeeting = await service.createRecordingMeeting({
      userId: "local_user_1",
    } as never);

    assert.equal(project.findUnique.mock.callCount(), 0);
    assert.equal(project.create.mock.callCount(), 1);
    const projectCreateCall = project.create.mock.calls[0];
    assert.ok(projectCreateCall);
    const projectCreateArgs = projectCreateCall.arguments[0] as {
      data: {
        userId: string;
        title: string;
        isDraft: boolean;
      };
      select: {
        id: true;
      };
    };
    assert.equal(projectCreateArgs.data.userId, "local_user_1");
    assert.equal(projectCreateArgs.data.isDraft, true);
    assert.match(projectCreateArgs.data.title, /^Draft Project /);
    assert.deepEqual(projectCreateArgs.select, {
      id: true,
    });
    assert.equal(meeting.create.mock.callCount(), 1);
    const meetingCreateCall = meeting.create.mock.calls[0];
    assert.ok(meetingCreateCall);
    const meetingCreateArgs = meetingCreateCall.arguments[0] as {
      data: {
        userId: string;
        title: string;
        status: string;
        externalMeetingId: string | null;
        projectId: string;
      };
      select: {
        id: true;
        externalMeetingId: true;
        status: true;
        title: true;
        userId: true;
        projectId: true;
      };
    };
    assert.equal(meetingCreateArgs.data.userId, "local_user_1");
    assert.match(meetingCreateArgs.data.title, /^Recording /);
    assert.equal(meetingCreateArgs.data.status, "RECORDING");
    assert.equal(meetingCreateArgs.data.externalMeetingId, null);
    assert.equal(meetingCreateArgs.data.projectId, "project_draft_1");
    assert.deepEqual(meetingCreateArgs.select, {
      id: true,
      externalMeetingId: true,
      status: true,
      title: true,
      userId: true,
      projectId: true,
    });
    assert.deepEqual(createdMeeting, {
      id: "meeting_project_2",
      title: "Recording 2026-04-25T00:00:00.000Z",
      status: "RECORDING",
      ingestionSource: "LIVE_CAPTURE",
      externalMeetingId: null,
      userId: "local_user_1",
      projectId: "project_draft_1",
    });
  });

  void it("lists dashboard meeting history with derived total duration", async () => {
    const { service, meeting } = createService();

    meeting.findMany.mock.mockImplementation(async () => [
      {
        id: "meeting_2",
        title: "Design Review",
        status: "COMPLETED",
        ingestionSource: "LIVE_CAPTURE",
        artifactReviewStatus: "READY",
        captureContext: null,
        degradedWithoutSelfMic: false,
        externalMeetingId: "abc-defg-hij",
        projectId: "project_1",
        project: { title: "Kapter" },
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:45:00.000Z"),
        audioBatches: [
          { durationMs: 1200000, sourceType: null },
          { durationMs: 300000, sourceType: null },
        ],
      },
      {
        id: "meeting_1",
        title: "Daily Standup",
        status: "PROCESSING",
        ingestionSource: "LIVE_CAPTURE",
        artifactReviewStatus: "PENDING",
        captureContext: null,
        degradedWithoutSelfMic: false,
        externalMeetingId: null,
        projectId: "project_1",
        project: { title: "Kapter" },
        createdAt: new Date("2026-04-21T08:00:00.000Z"),
        updatedAt: new Date("2026-04-21T08:15:00.000Z"),
        audioBatches: [{ durationMs: 900000, sourceType: null }],
      },
    ]);

    const history = await service.listMeetingHistory("clerk_user_1");

    assert.equal(meeting.findMany.mock.callCount(), 1);
    assert.deepEqual(history, [
      {
        id: "meeting_2",
        title: "Design Review",
        status: "COMPLETED",
        ingestionSource: "LIVE_CAPTURE",
        artifactReviewStatus: "READY",
        captureContext: null,
        degradedWithoutSelfMic: false,
        activeSourceTypes: [],
        externalMeetingId: "abc-defg-hij",
        projectId: "project_1",
        projectTitle: "Kapter",
        createdAt: "2026-04-21T10:00:00.000Z",
        updatedAt: "2026-04-21T10:45:00.000Z",
        totalDurationMs: 1500000,
      },
      {
        id: "meeting_1",
        title: "Daily Standup",
        status: "PROCESSING",
        ingestionSource: "LIVE_CAPTURE",
        artifactReviewStatus: "PENDING",
        captureContext: null,
        degradedWithoutSelfMic: false,
        activeSourceTypes: [],
        externalMeetingId: null,
        projectId: "project_1",
        projectTitle: "Kapter",
        createdAt: "2026-04-21T08:00:00.000Z",
        updatedAt: "2026-04-21T08:15:00.000Z",
        totalDurationMs: 900000,
      },
    ]);
  });

  void it("deletes an owned meeting and its persisted artifacts", async () => {
    const { service, meeting } = createService();

    meeting.findFirst.mock.mockImplementation(async () => ({
      id: "meeting_1",
    }));

    await service.deleteMeeting("clerk_user_1", "meeting_1");

    assert.equal(meeting.findFirst.mock.callCount(), 1);
    assert.deepEqual(meeting.findFirst.mock.calls[0]?.arguments[0], {
      where: {
        id: "meeting_1",
        user: {
          is: {
            clerkId: "clerk_user_1",
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });
    assert.equal(meeting.delete.mock.callCount(), 1);
    assert.deepEqual(meeting.delete.mock.calls[0]?.arguments[0], {
      where: {
        id: "meeting_1",
      },
    });
  });

  void it("throws when deleting a meeting that does not belong to the current Clerk user", async () => {
    const { service, meeting } = createService();

    meeting.findFirst.mock.mockImplementation(async () => null);

    await assert.rejects(
      () => service.deleteMeeting("clerk_user_1", "missing_meeting"),
      NotFoundException,
    );

    assert.equal(meeting.delete.mock.callCount(), 0);
  });

  void it("returns the latest active dashboard meeting snapshot", async () => {
    const { service, meeting } = createService();

    meeting.findFirst.mock.mockImplementation(async () => ({
      id: "meeting_active",
      title: "Sprint Planning",
      status: "RECORDING",
      ingestionSource: "LIVE_CAPTURE",
      artifactReviewStatus: "PENDING",
      captureContext: null,
      degradedWithoutSelfMic: false,
      externalMeetingId: "planning-room",
      projectId: "project_1",
      project: { title: "Kapter" },
      createdAt: new Date("2026-04-21T12:00:00.000Z"),
      updatedAt: new Date("2026-04-21T12:05:00.000Z"),
      audioBatches: [
        { durationMs: 600000, sourceType: null },
        { durationMs: 120000, sourceType: null },
      ],
    }));

    const activeMeeting = await service.getActiveMeeting("clerk_user_1");

    assert.equal(meeting.findFirst.mock.callCount(), 1);
    assert.deepEqual(activeMeeting, {
      id: "meeting_active",
      title: "Sprint Planning",
      status: "RECORDING",
      ingestionSource: "LIVE_CAPTURE",
      artifactReviewStatus: "PENDING",
      captureContext: null,
      degradedWithoutSelfMic: false,
      activeSourceTypes: [],
      externalMeetingId: "planning-room",
      projectId: "project_1",
      projectTitle: "Kapter",
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:05:00.000Z",
      totalDurationMs: 720000,
    });
  });

  void it("returns null when the current user has no active meeting", async () => {
    const { service } = createService();

    const activeMeeting = await service.getActiveMeeting("clerk_user_1");

    assert.equal(activeMeeting, null);
  });

  void it("returns meeting detail with transcript, speakers, action items, and processing progress", async () => {
    const { service, meeting } = createService();

    meeting.findFirst.mock.mockImplementation(async () => ({
      id: "meeting_detail_1",
      title: "Sprint Planning",
      status: "PROCESSING",
      ingestionSource: "LIVE_CAPTURE",
      artifactReviewStatus: "READY",
      artifactExtractionError: null,
      artifactApprovedAt: null,
      captureContext: null,
      degradedWithoutSelfMic: false,
      externalMeetingId: "planning-room",
      projectId: "project_1",
      project: {
        title: "Kapter",
        notionDestinationMode: "PROJECT_PAGE",
        notionProjectPageId: "notion_project_page_1",
        notionTaskDatabaseId: "notion_task_db_1",
      },
      user: {
        NotionConnection: {
          workspaceId: "workspace_1",
          workspaceName: "Kapter Workspace",
          workspaceIcon: "https://example.com/notion-workspace.png",
        },
      },
      summary: null,
      createdAt: new Date("2026-04-21T12:00:00.000Z"),
      updatedAt: new Date("2026-04-21T12:10:00.000Z"),
      audioBatches: [
        {
          id: "batch_1",
          status: "COMPLETED",
          processedAt: new Date("2026-04-21T12:09:00.000Z"),
          durationMs: 120000,
          sourceType: null,
        },
        {
          id: "batch_2",
          status: "PENDING",
          processedAt: null,
          durationMs: 60000,
          sourceType: null,
        },
      ],
      speakers: [
        {
          id: "speaker_1",
          aiLabel: "Speaker 0",
          realName: null,
          voiceProfileId: null,
          recurringSpeakerProfileId: null,
          recurringMatchConfidence: null,
          recurringMatchSeenCount: null,
          voiceProfile: null,
          _count: {
            segments: 2,
            actionItems: 0,
            evidenceSamples: 0,
          },
        },
      ],
      transcript: [
        {
          id: "segment_1",
          content: "Let us review the sprint goals.",
          startTime: 0,
          endTime: 4.2,
          speakerId: "speaker_1",
          sourceType: null,
          mergeStrategy: null,
          mergeSourceType: null,
          speaker: {
            aiLabel: "Speaker 0",
            realName: null,
          },
        },
      ],
      actionItems: [
        {
          id: "action_item_1",
          taskContent: "Create the rollout checklist",
          deadline: new Date("2026-04-25T17:00:00.000Z"),
          status: "TODO",
          isSynced: true,
          notionPageId: "notion_task_1",
          updatedAt: new Date("2026-04-21T12:08:00.000Z"),
          createdAt: new Date("2026-04-21T12:07:00.000Z"),
          assigneeId: "speaker_1",
          assignee: {
            aiLabel: "Speaker 0",
            realName: null,
          },
        },
        {
          id: "action_item_2",
          taskContent: "Share the updated sprint scope",
          deadline: null,
          status: "IN_PROGRESS",
          isSynced: false,
          notionPageId: null,
          updatedAt: new Date("2026-04-21T12:09:00.000Z"),
          createdAt: new Date("2026-04-21T12:08:00.000Z"),
          assigneeId: null,
          assignee: null,
        },
      ],
      contextUpdateProposals: [],
      extractionChunks: [
        {
          chunkIndex: 0,
          status: "COMPLETED",
          processedAt: new Date("2026-04-21T12:09:30.000Z"),
        },
        {
          chunkIndex: 1,
          status: "PENDING",
          processedAt: null,
        },
      ],
      artifactDraft: {
        finalizationStatus: "PROCESSING",
      },
    }));

    const detail = await service.getMeetingDetail(
      "clerk_user_1",
      "meeting_detail_1",
    );

    assert.equal(meeting.findFirst.mock.callCount(), 1);
    assert.deepEqual(detail, {
      id: "meeting_detail_1",
      title: "Sprint Planning",
      status: "PROCESSING",
      ingestionSource: "LIVE_CAPTURE",
      artifactReviewStatus: "READY",
      artifactExtractionError: null,
      artifactApprovedAt: null,
      captureContext: null,
      degradedWithoutSelfMic: false,
      activeSourceTypes: [],
      externalMeetingId: "planning-room",
      projectId: "project_1",
      projectTitle: "Kapter",
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:10:00.000Z",
      totalDurationMs: 180000,
      summary: null,
      pendingContextProposal: null,
      speakers: [
        {
          id: "speaker_1",
          aiLabel: "Speaker 0",
          realName: null,
          segmentCount: 2,
          actionItemCount: 0,
          voiceProfileId: null,
          voiceProfileName: null,
          isMapped: false,
          promotionEligible: false,
          recurringSpeakerProfileId: null,
          recurringMatchConfidence: null,
          recurringMatchSeenCount: null,
          recurringSuggestionLabel: null,
          speakerMapping: {
            speakerId: "speaker_1",
            voiceProfileId: null,
            voiceProfileName: null,
            isMapped: false,
            promotionEligible: false,
          },
        },
      ],
      transcriptSegments: [
        {
          id: "segment_1",
          speakerId: "speaker_1",
          aiLabel: "Speaker 0",
          realName: null,
          content: "Let us review the sprint goals.",
          startTime: 0,
          endTime: 4.2,
          sourceType: null,
          mergeStrategy: null,
          mergeSourceType: null,
        },
      ],
      actionItems: [
        {
          id: "action_item_1",
          taskContent: "Create the rollout checklist",
          deadline: "2026-04-25T17:00:00.000Z",
          status: "TODO",
          isSynced: true,
          notionPageId: "notion_task_1",
          assigneeId: "speaker_1",
          assigneeAiLabel: "Speaker 0",
          assigneeRealName: null,
          createdAt: "2026-04-21T12:07:00.000Z",
        },
        {
          id: "action_item_2",
          taskContent: "Share the updated sprint scope",
          deadline: null,
          status: "IN_PROGRESS",
          isSynced: false,
          notionPageId: null,
          assigneeId: null,
          assigneeAiLabel: null,
          assigneeRealName: null,
          createdAt: "2026-04-21T12:08:00.000Z",
        },
      ],
      syncReadiness: {
        notion: {
          connected: true,
          workspace: {
            id: "workspace_1",
            name: "Kapter Workspace",
            icon: "https://example.com/notion-workspace.png",
          },
        },
        projectDestination: {
          mode: "PROJECT_PAGE",
          projectPageId: "notion_project_page_1",
          taskDatabaseId: "notion_task_db_1",
        },
        syncedActionItemCount: 1,
        unsyncedActionItemCount: 1,
      },
      processing: {
        totalBatches: 2,
        completedBatches: 1,
        failedBatches: 0,
        pendingBatches: 1,
        transcriptSegmentCount: 1,
        latestProcessedAt: "2026-04-21T12:09:00.000Z",
      },
      artifactProcessing: {
        totalChunks: 2,
        completedChunks: 1,
        failedChunks: 0,
        pendingChunks: 1,
        latestProcessedAt: "2026-04-21T12:09:30.000Z",
        finalizationStatus: "PROCESSING",
      },
    });
  });

  void it("throws when the requested meeting does not belong to the current Clerk user", async () => {
    const { service } = createService();

    await assert.rejects(
      () => service.getMeetingDetail("clerk_user_1", "missing_meeting"),
      NotFoundException,
    );
  });

  void it("updates editable meeting metadata and reassigns the meeting before approval", async () => {
    const { service, meeting, project } = createService();

    meeting.findFirst.mock.mockImplementation(async () => ({
      id: "meeting_1",
      userId: "local_user_1",
      projectId: "project_1",
      artifactReviewStatus: "READY",
      actionItems: [],
    }));
    project.findUnique.mock.mockImplementation(async () => ({
      id: "project_2",
      userId: "local_user_1",
    }));

    const getMeetingDetail = mock.method(
      service,
      "getMeetingDetail",
      async () =>
        ({
          id: "meeting_1",
          title: "Renamed meeting",
          status: "COMPLETED",
        }) as never,
    );

    await service.updateMeetingMetadata("clerk_user_1", "meeting_1", {
      title: " Renamed meeting ",
      description: " Updated notes ",
      externalMeetingId: " ext-room-123 ",
      projectId: " project_2 ",
    });

    assert.equal(project.findUnique.mock.callCount(), 1);
    assert.deepEqual(project.findUnique.mock.calls[0]?.arguments[0], {
      where: {
        id: "project_2",
      },
      select: {
        id: true,
        userId: true,
      },
    });
    assert.equal(meeting.update.mock.callCount(), 1);
    assert.deepEqual(meeting.update.mock.calls[0]?.arguments[0], {
      where: {
        id: "meeting_1",
      },
      data: {
        title: "Renamed meeting",
        description: "Updated notes",
        externalMeetingId: "ext-room-123",
        projectId: "project_2",
      },
    });
    assert.equal(getMeetingDetail.mock.callCount(), 1);
  });

  void it("blocks meeting project reassignment after approval", async () => {
    const { service, meeting } = createService();

    meeting.findFirst.mock.mockImplementation(async () => ({
      id: "meeting_1",
      userId: "local_user_1",
      projectId: "project_1",
      artifactReviewStatus: "APPROVED",
      actionItems: [],
    }));

    await assert.rejects(
      () =>
        service.updateMeetingMetadata("clerk_user_1", "meeting_1", {
          projectId: "project_2",
        }),
      BadRequestException,
    );

    assert.equal(meeting.update.mock.callCount(), 0);
  });

  void it("returns immediately after scheduling retry extraction in the background", async () => {
    let findFirstCallCount = 0;
    const findFirst = mock.fn(async () => {
      findFirstCallCount += 1;

      if (findFirstCallCount === 1) {
        return {
          id: "meeting_retry_1",
          artifactReviewStatus: "FAILED",
          _count: {
            transcript: 1,
          },
        };
      }

      return {
        id: "meeting_retry_1",
        title: "Retry meeting",
        status: "COMPLETED",
        ingestionSource: "LIVE_CAPTURE",
        artifactReviewStatus: "PENDING",
        artifactExtractionError: null,
        artifactApprovedAt: null,
        externalMeetingId: null,
        projectId: "project_1",
        project: { title: "Kapter" },
        summary: null,
        createdAt: new Date("2026-04-26T14:00:00.000Z"),
        updatedAt: new Date("2026-04-26T14:01:00.000Z"),
        audioBatches: [],
        speakers: [],
        transcript: [],
        actionItems: [],
        contextUpdateProposals: [],
        extractionChunks: [],
        artifactDraft: null,
      };
    });
    const resetMeetingArtifacts = mock.fn(async () => undefined);
    const scheduleMeetingArtifactProcessing = mock.fn(() => undefined);

    const service = new MeetingsService(
      {
        meeting: {
          findFirst,
        },
      } as never,
      {
        getOwnedVoiceProfileSummary: mock.fn(),
        promoteMeetingSpeakerToVoiceProfile: mock.fn(),
      } as never,
      undefined,
      {
        resetMeetingArtifacts,
        scheduleMeetingArtifactProcessing,
      } as never,
    );

    const detail = await service.retryMeetingExtraction(
      "clerk_user_1",
      "meeting_retry_1",
    );

    assert.equal(resetMeetingArtifacts.mock.callCount(), 1);
    assert.equal(scheduleMeetingArtifactProcessing.mock.callCount(), 1);
    assert.equal(detail.id, "meeting_retry_1");
    assert.equal(detail.artifactReviewStatus, "PENDING");
  });
});
