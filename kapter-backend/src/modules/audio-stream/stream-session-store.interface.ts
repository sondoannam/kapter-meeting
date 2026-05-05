import type { ActiveStreamSession } from "./active-stream-session.type";

export interface StreamSessionStore {
  create(session: ActiveStreamSession): void;
  get(streamId: string): ActiveStreamSession | undefined;
  update(session: ActiveStreamSession): void;
  delete(streamId: string): void;
  listAll(): ActiveStreamSession[];
  listPendingFlushes(): ActiveStreamSession[];
}
