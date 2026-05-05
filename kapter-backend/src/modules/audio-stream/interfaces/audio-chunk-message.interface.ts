export interface AudioChunkMessage {
  streamId: string;
  sequence: number;
  mimeType: string;
  payload: string;
  durationMs?: number;
}
