from __future__ import annotations

from collections.abc import Sequence

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from kapter_ai_worker.core.entities import DiarizedTranscriptSegment


class BackendContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
    )

    def to_backend_dict(self) -> dict[str, object]:
        return self.model_dump(by_alias=True)


class WorkerAudioBatchRequest(BackendContractModel):
    stream_id: str = Field(..., alias="streamId", min_length=1)
    backend_meeting_id: str = Field(
        ...,
        validation_alias=AliasChoices("backendMeetingId", "meetingId"),
        serialization_alias="backendMeetingId",
        min_length=1,
    )
    sequence_start: int = Field(
        ...,
        validation_alias=AliasChoices("sequenceStart", "chunkSequenceStart"),
        serialization_alias="sequenceStart",
        ge=0,
    )
    sequence_end: int = Field(
        ...,
        validation_alias=AliasChoices("sequenceEnd", "chunkSequenceEnd"),
        serialization_alias="sequenceEnd",
        ge=0,
    )
    stream_offset_ms: int = Field(..., alias="streamOffsetMs", ge=0)
    duration_ms: int = Field(..., alias="durationMs", gt=0)
    mime_type: str = Field(..., alias="mimeType", min_length=1)
    audio_base64: str = Field(..., alias="audioBase64", min_length=1)
    is_final: bool = Field(False, alias="isFinal")
    capture_context: str | None = Field(None, alias="captureContext")
    source_type: str | None = Field(None, alias="sourceType")
    authoritative_speaker_label: str | None = Field(
        None,
        alias="authoritativeSpeakerLabel",
        min_length=1,
    )

    @model_validator(mode="after")
    def validate_sequence_window(self) -> "WorkerAudioBatchRequest":
        if self.sequence_end < self.sequence_start:
            raise ValueError(
                "sequence_end must be greater than or equal to sequence_start."
            )

        return self


class WorkerTranscriptSegment(BackendContractModel):
    start_time: float = Field(..., alias="startTime", ge=0)
    end_time: float = Field(..., alias="endTime", gt=0)
    content: str = Field(..., min_length=1)
    ai_label: str = Field(..., alias="aiLabel", min_length=1)
    confidence: float | None = Field(None, ge=0.0, le=1.0)
    source_type: str | None = Field(None, alias="sourceType")

    @model_validator(mode="after")
    def validate_time_range(self) -> "WorkerTranscriptSegment":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time.")

        return self

    @classmethod
    def from_entity(
        cls,
        segment: DiarizedTranscriptSegment,
        *,
        source_type: str | None = None,
    ) -> "WorkerTranscriptSegment":
        return cls(
            start_time=segment.start_time,
            end_time=segment.end_time,
            content=segment.text,
            ai_label=segment.speaker_label,
            confidence=segment.confidence,
            source_type=source_type,
        )


class WorkerTranscriptionResponse(BackendContractModel):
    stream_id: str = Field(..., alias="streamId", min_length=1)
    backend_meeting_id: str = Field(
        ...,
        validation_alias=AliasChoices("backendMeetingId", "meetingId"),
        serialization_alias="backendMeetingId",
        min_length=1,
    )
    sequence_start: int = Field(
        ...,
        validation_alias=AliasChoices("sequenceStart", "chunkSequenceStart"),
        serialization_alias="sequenceStart",
        ge=0,
    )
    sequence_end: int = Field(
        ...,
        validation_alias=AliasChoices("sequenceEnd", "chunkSequenceEnd"),
        serialization_alias="sequenceEnd",
        ge=0,
    )
    stream_offset_ms: int = Field(..., alias="streamOffsetMs", ge=0)
    segments: list[WorkerTranscriptSegment] = Field(default_factory=list)
    capture_context: str | None = Field(None, alias="captureContext")
    source_type: str | None = Field(None, alias="sourceType")

    @model_validator(mode="after")
    def validate_sequence_window(self) -> "WorkerTranscriptionResponse":
        if self.sequence_end < self.sequence_start:
            raise ValueError(
                "sequence_end must be greater than or equal to sequence_start."
            )

        return self

    @classmethod
    def from_entities(
        cls,
        *,
        stream_id: str,
        backend_meeting_id: str,
        sequence_start: int,
        sequence_end: int,
        stream_offset_ms: int,
        segments: Sequence[DiarizedTranscriptSegment],
        capture_context: str | None = None,
        source_type: str | None = None,
    ) -> "WorkerTranscriptionResponse":
        return cls(
            stream_id=stream_id,
            backend_meeting_id=backend_meeting_id,
            sequence_start=sequence_start,
            sequence_end=sequence_end,
            stream_offset_ms=stream_offset_ms,
            capture_context=capture_context,
            source_type=source_type,
            segments=[
                WorkerTranscriptSegment.from_entity(
                    segment,
                    source_type=source_type,
                )
                for segment in segments
            ],
        )
