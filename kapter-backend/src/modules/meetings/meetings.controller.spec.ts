import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { MeetingsController } from "./meetings.controller";

void describe("MeetingsController", () => {
  const createMeetingUploadService = () =>
    ({
      acceptUpload: mock.fn(async () => undefined),
    }) as never;

  void it("returns dashboard meeting history for the current Clerk user", async () => {
    const listMeetingHistory = mock.fn(async () => [
      {
        id: "meeting_1",
        title: "Daily Standup",
        status: "COMPLETED",
        externalMeetingId: null,
        createdAt: "2026-04-21T08:00:00.000Z",
        updatedAt: "2026-04-21T08:15:00.000Z",
        totalDurationMs: 900000,
      },
    ]);

    const controller = new MeetingsController(
      {
        listMeetingHistory,
        getActiveMeeting: mock.fn(async () => null),
      } as never,
      createMeetingUploadService(),
    );

    const response = await controller.getMeetingHistory({
      userId: "clerk_user_1",
      sessionId: null,
      authorizedParty: null,
      claims: {},
    });

    assert.equal(listMeetingHistory.mock.callCount(), 1);
    assert.deepEqual(listMeetingHistory.mock.calls[0]?.arguments, [
      "clerk_user_1",
    ]);
    assert.deepEqual(response, {
      meetings: [
        {
          id: "meeting_1",
          title: "Daily Standup",
          status: "COMPLETED",
          externalMeetingId: null,
          createdAt: "2026-04-21T08:00:00.000Z",
          updatedAt: "2026-04-21T08:15:00.000Z",
          totalDurationMs: 900000,
        },
      ],
    });
  });

  void it("returns the current active dashboard meeting for the current Clerk user", async () => {
    const getActiveMeeting = mock.fn(async () => ({
      id: "meeting_active",
      title: "Sprint Planning",
      status: "PROCESSING",
      externalMeetingId: "planning-room",
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:10:00.000Z",
      totalDurationMs: 720000,
    }));

    const controller = new MeetingsController(
      {
        listMeetingHistory: mock.fn(async () => []),
        getActiveMeeting,
      } as never,
      createMeetingUploadService(),
    );

    const response = await controller.getActiveMeetingForUser({
      userId: "clerk_user_1",
      sessionId: null,
      authorizedParty: null,
      claims: {},
    });

    assert.equal(getActiveMeeting.mock.callCount(), 1);
    assert.deepEqual(getActiveMeeting.mock.calls[0]?.arguments, [
      "clerk_user_1",
    ]);
    assert.deepEqual(response, {
      meeting: {
        id: "meeting_active",
        title: "Sprint Planning",
        status: "PROCESSING",
        externalMeetingId: "planning-room",
        createdAt: "2026-04-21T12:00:00.000Z",
        updatedAt: "2026-04-21T12:10:00.000Z",
        totalDurationMs: 720000,
      },
    });
  });

  void it("returns the dashboard meeting detail payload for the requested meeting", async () => {
    const getMeetingDetail = mock.fn(async () => ({
      id: "meeting_detail_1",
      title: "Sprint Planning",
      status: "PROCESSING",
      externalMeetingId: "planning-room",
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:10:00.000Z",
      totalDurationMs: 720000,
      summary: null,
      speakers: [
        {
          id: "speaker_1",
          aiLabel: "Speaker 0",
          realName: null,
          segmentCount: 2,
          actionItemCount: 0,
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
        },
      ],
      actionItems: [],
      processing: {
        totalBatches: 2,
        completedBatches: 1,
        failedBatches: 0,
        pendingBatches: 1,
        transcriptSegmentCount: 1,
        latestProcessedAt: "2026-04-21T12:09:00.000Z",
      },
    }));

    const controller = new MeetingsController(
      {
        listMeetingHistory: mock.fn(async () => []),
        getActiveMeeting: mock.fn(async () => null),
        getMeetingDetail,
      } as never,
      createMeetingUploadService(),
    );

    const response = await controller.getMeetingDetailForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      "meeting_detail_1",
    );

    assert.equal(getMeetingDetail.mock.callCount(), 1);
    assert.deepEqual(getMeetingDetail.mock.calls[0]?.arguments, [
      "clerk_user_1",
      "meeting_detail_1",
    ]);
    assert.deepEqual(response, {
      meeting: {
        id: "meeting_detail_1",
        title: "Sprint Planning",
        status: "PROCESSING",
        externalMeetingId: "planning-room",
        createdAt: "2026-04-21T12:00:00.000Z",
        updatedAt: "2026-04-21T12:10:00.000Z",
        totalDurationMs: 720000,
        summary: null,
        speakers: [
          {
            id: "speaker_1",
            aiLabel: "Speaker 0",
            realName: null,
            segmentCount: 2,
            actionItemCount: 0,
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
          },
        ],
        actionItems: [],
        processing: {
          totalBatches: 2,
          completedBatches: 1,
          failedBatches: 0,
          pendingBatches: 1,
          transcriptSegmentCount: 1,
          latestProcessedAt: "2026-04-21T12:09:00.000Z",
        },
      },
    });
  });

  void it("deletes the requested meeting for the current Clerk user", async () => {
    const deleteMeeting = mock.fn(async () => undefined);

    const controller = new MeetingsController(
      {
        listMeetingHistory: mock.fn(async () => []),
        getActiveMeeting: mock.fn(async () => null),
        getMeetingDetail: mock.fn(async () => undefined),
        deleteMeeting,
      } as never,
      createMeetingUploadService(),
    );

    const response = await controller.deleteMeetingForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      "meeting_detail_1",
    );

    assert.equal(deleteMeeting.mock.callCount(), 1);
    assert.deepEqual(deleteMeeting.mock.calls[0]?.arguments, [
      "clerk_user_1",
      "meeting_detail_1",
    ]);
    assert.deepEqual(response, {
      deletedMeetingId: "meeting_detail_1",
    });
  });

  void it("updates editable meeting metadata for the current Clerk user", async () => {
    const updateMeetingMetadata = mock.fn(async () => ({
      id: "meeting_detail_1",
      title: "Renamed meeting",
      status: "COMPLETED",
      artifactReviewStatus: "READY",
      externalMeetingId: "room-123",
      projectId: "project_2",
      projectTitle: "Platform Revamp",
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:10:00.000Z",
      totalDurationMs: 720000,
    }));

    const controller = new MeetingsController(
      {
        listMeetingHistory: mock.fn(async () => []),
        getActiveMeeting: mock.fn(async () => null),
        getMeetingDetail: mock.fn(async () => undefined),
        updateMeetingMetadata,
      } as never,
      createMeetingUploadService(),
    );

    const response = await controller.updateMeetingMetadataForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      "meeting_detail_1",
      {
        title: "Renamed meeting",
        externalMeetingId: "room-123",
        projectId: "project_2",
      },
    );

    assert.equal(updateMeetingMetadata.mock.callCount(), 1);
    assert.deepEqual(updateMeetingMetadata.mock.calls[0]?.arguments, [
      "clerk_user_1",
      "meeting_detail_1",
      {
        title: "Renamed meeting",
        externalMeetingId: "room-123",
        projectId: "project_2",
      },
    ]);
    assert.deepEqual(response, {
      meeting: {
        id: "meeting_detail_1",
        title: "Renamed meeting",
        status: "COMPLETED",
        artifactReviewStatus: "READY",
        externalMeetingId: "room-123",
        projectId: "project_2",
        projectTitle: "Platform Revamp",
        createdAt: "2026-04-21T12:00:00.000Z",
        updatedAt: "2026-04-21T12:10:00.000Z",
        totalDurationMs: 720000,
      },
    });
  });

  void it("syncs approved meeting action items to Notion and returns refreshed detail", async () => {
    const getMeetingDetail = mock.fn(async () => ({
      id: "meeting_detail_1",
      title: "Sprint Planning",
      status: "COMPLETED",
      artifactReviewStatus: "APPROVED",
      externalMeetingId: "planning-room",
      projectId: "project_1",
      projectTitle: "Platform Revamp",
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:10:00.000Z",
      totalDurationMs: 720000,
      summary: "Reviewed summary",
      artifactExtractionError: null,
      artifactApprovedAt: "2026-04-21T12:09:00.000Z",
      speakers: [],
      transcriptSegments: [],
      actionItems: [],
      pendingContextProposal: null,
      processing: {
        totalBatches: 2,
        completedBatches: 2,
        failedBatches: 0,
        pendingBatches: 0,
        transcriptSegmentCount: 4,
        latestProcessedAt: "2026-04-21T12:09:00.000Z",
      },
    }));
    const syncMeetingActionItems = mock.fn(async () => ({
      meetingId: "meeting_detail_1",
      projectId: "project_1",
      notionProjectPageId: "notion_page_1",
      notionTaskDatabaseId: "notion_database_1",
      notionTaskDataSourceId: "notion_data_source_1",
      createdDestination: false,
      syncedCount: 2,
      skippedCount: 0,
    }));

    const controller = new MeetingsController(
      {
        listMeetingHistory: mock.fn(async () => []),
        getActiveMeeting: mock.fn(async () => null),
        getMeetingDetail,
      } as never,
      createMeetingUploadService(),
      {
        syncMeetingActionItems,
      } as never,
    );

    const response = await controller.syncMeetingActionItemsToNotionForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      "meeting_detail_1",
    );

    assert.equal(syncMeetingActionItems.mock.callCount(), 1);
    assert.deepEqual(syncMeetingActionItems.mock.calls[0]?.arguments, [
      "clerk_user_1",
      "meeting_detail_1",
    ]);
    assert.equal(getMeetingDetail.mock.callCount(), 1);
    assert.deepEqual(response.sync, {
      meetingId: "meeting_detail_1",
      projectId: "project_1",
      notionProjectPageId: "notion_page_1",
      notionTaskDatabaseId: "notion_database_1",
      notionTaskDataSourceId: "notion_data_source_1",
      createdDestination: false,
      syncedCount: 2,
      skippedCount: 0,
    });
    assert.equal(response.meeting.id, "meeting_detail_1");
  });

  void it("accepts one uploaded MP3 meeting for the current Clerk user", async () => {
    const acceptUpload = mock.fn(async () => ({
      id: "meeting_upload_1",
      title: "Customer Interview",
      status: "PROCESSING",
      ingestionSource: "FILE_UPLOAD",
      artifactReviewStatus: "PENDING",
      captureContext: null,
      degradedWithoutSelfMic: false,
      activeSourceTypes: ["tab_mix"],
      externalMeetingId: null,
      projectId: "project_1",
      projectTitle: "Research",
      createdAt: "2026-05-16T10:00:00.000Z",
      updatedAt: "2026-05-16T10:00:00.000Z",
      totalDurationMs: 0,
    }));

    const controller = new MeetingsController(
      {
        listMeetingHistory: mock.fn(async () => []),
        getActiveMeeting: mock.fn(async () => null),
      } as never,
      {
        acceptUpload,
      } as never,
    );

    const file = {
      buffer: Buffer.from("mp3-bytes"),
      mimetype: "audio/mpeg",
      originalname: "customer-interview.mp3",
      size: 1024,
    };

    const response = await controller.uploadMeetingAudioForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      {
        title: "Customer Interview",
        projectId: "project_1",
      },
      file,
    );

    assert.equal(acceptUpload.mock.callCount(), 1);
    assert.deepEqual(acceptUpload.mock.calls[0]?.arguments, [
      "clerk_user_1",
      file,
      {
        title: "Customer Interview",
        projectId: "project_1",
      },
    ]);
    assert.equal(response.status, "accepted");
    assert.equal(response.meeting.id, "meeting_upload_1");
    assert.equal(response.meeting.ingestionSource, "FILE_UPLOAD");
  });
});
