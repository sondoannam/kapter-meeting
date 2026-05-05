import { Injectable } from "@nestjs/common";

import type { ActiveStreamSession } from "./active-stream-session.type";
import type { StreamSessionStore } from "./stream-session-store.interface";

@Injectable()
export class InMemoryStreamSessionStore implements StreamSessionStore {
  private readonly sessions = new Map<string, ActiveStreamSession>();

  create(session: ActiveStreamSession): void {
    this.sessions.set(session.streamId, session);
  }

  get(streamId: string): ActiveStreamSession | undefined {
    return this.sessions.get(streamId);
  }

  update(session: ActiveStreamSession): void {
    this.sessions.set(session.streamId, session);
  }

  delete(streamId: string): void {
    this.sessions.delete(streamId);
  }

  listAll(): ActiveStreamSession[] {
    return [...this.sessions.values()];
  }

  listPendingFlushes(): ActiveStreamSession[] {
    return [...this.sessions.values()].filter((session) =>
      Object.values(session.audioSources).some(
        (sourceState) =>
          !!sourceState &&
          sourceState.bufferedDurationMs > 0 &&
          !sourceState.workerInFlight,
      ),
    );
  }
}
