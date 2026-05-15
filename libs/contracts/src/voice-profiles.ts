import type { IsoDateTimeString } from "./domain";

export type VoiceProfileCacheSyncStatus = "PENDING" | "SYNCED" | "FAILED";

export type VoiceProfileSampleSource = "UPLOAD" | "MEETING_PROMOTION";

export interface VoiceProfileSampleSummary {
  id: string;
  source: VoiceProfileSampleSource;
  durationSeconds: number;
  rmsDb: number | null;
  speechRatio: number | null;
  qualityScore: number | null;
  sampleRate: number | null;
  sourceMeetingId: string | null;
  sourceSpeakerProfileId: string | null;
  createdAt: IsoDateTimeString;
}

export interface VoiceProfile {
  id: string;
  displayName: string;
  position: string | null;
  department: string | null;
  isActive: boolean;
  workerCacheStatus: VoiceProfileCacheSyncStatus;
  workerCacheError: string | null;
  lastSyncedAt: IsoDateTimeString | null;
  sampleCount: number;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  samples: VoiceProfileSampleSummary[];
}

export interface CreateVoiceProfileInput {
  displayName: string;
  position?: string | null;
  department?: string | null;
  isActive?: boolean;
}

export interface UpdateVoiceProfileInput {
  displayName?: string;
  position?: string | null;
  department?: string | null;
  isActive?: boolean;
}

export interface VoiceProfilesResponse {
  voiceProfiles: VoiceProfile[];
}

export interface VoiceProfileResponse {
  voiceProfile: VoiceProfile;
}

export interface DeleteVoiceProfileResponse {
  deletedVoiceProfileId: string;
}

export interface VoiceProfileEnrollmentResponse {
  voiceProfile: VoiceProfile;
  sample: VoiceProfileSampleSummary;
}

export interface LinkMeetingSpeakerRequest {
  voiceProfileId: string;
}

export interface MeetingSpeakerPromotionRequest {
  displayName: string;
  position?: string | null;
  department?: string | null;
  isActive?: boolean;
}

export interface MeetingSpeakerMapping {
  speakerId: string;
  voiceProfileId: string | null;
  voiceProfileName: string | null;
  isMapped: boolean;
  promotionEligible: boolean;
}
