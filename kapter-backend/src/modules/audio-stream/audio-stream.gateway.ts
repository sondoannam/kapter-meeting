import { Inject } from "@nestjs/common";
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  type WsResponse,
} from "@nestjs/websockets";
import type { ConfigType } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Namespace, Socket } from "socket.io";
import type { Logger } from "winston";

import { appConfig, buildAppConfig } from "../../config/app.config";
import { parseCorsOrigins } from "../../config/cors.util";
import { ClerkAuthService } from "../clerk/clerk-auth.service";
import { extractSessionTokenFromHandshake } from "../clerk/clerk-socket-auth";
import { AudioChunkDto } from "./dto/audio-chunk.dto";
import { StreamReadyDto } from "./dto/stream-ready.dto";
import { StreamStartDto } from "./dto/stream-start.dto";
import { StreamStopDto } from "./dto/stream-stop.dto";
import { AudioStreamService } from "./audio-stream.service";

type StreamStartAck = Awaited<ReturnType<AudioStreamService["beginStream"]>>;
type StreamReadyAck = Awaited<
  ReturnType<AudioStreamService["markStreamReady"]>
>;
type StreamChunkAck = ReturnType<AudioStreamService["handleChunk"]>;
type StreamStopAck = Awaited<ReturnType<AudioStreamService["stopStream"]>>;

const gatewayConfig = buildAppConfig();

interface SocketLocalUserContext {
  id: string;
  clerkId: string | null;
  email: string;
  name: string | null;
  imageUrl: string | null;
}

@WebSocketGateway({
  namespace: gatewayConfig.wsAudioNamespace,
  cors: {
    origin: parseCorsOrigins(gatewayConfig.corsOrigin),
    credentials: true,
  },
})
export class AudioStreamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly audioStreamService: AudioStreamService,
    private readonly clerkAuthService: ClerkAuthService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  afterInit(): void {
    this.server.use((socket, next) => {
      void this.authorizeSocket(socket, next);
    });

    this.logger.info("Audio stream gateway initialized", {
      namespace: this.config.wsAudioNamespace,
    });
  }

  handleConnection(client: Socket): void {
    this.logger.info("Audio stream client connected", {
      clientId: client.id,
      namespace: this.config.wsAudioNamespace,
      clerkUserId: client.data.auth?.userId,
      userId: client.data.userId,
    });
  }

  handleDisconnect(client: Socket): void {
    void this.audioStreamService.handleClientDisconnect(client.id);

    this.logger.info("Audio stream client disconnected", {
      clientId: client.id,
      namespace: this.config.wsAudioNamespace,
      clerkUserId: client.data.auth?.userId,
      userId: client.data.userId,
    });
  }

  private async authorizeSocket(
    client: Socket,
    next: (error?: Error) => void,
  ): Promise<void> {
    const sessionToken = extractSessionTokenFromHandshake(client.handshake);

    if (!sessionToken) {
      this.logger.warn("Rejected websocket connection without Clerk token", {
        clientId: client.id,
      });
      next(new Error("Missing Clerk session token"));
      return;
    }

    try {
      const auth = await this.clerkAuthService.verifySessionToken(sessionToken);
      const localUser = await this.clerkAuthService.getOrSyncLocalUser(
        auth.userId,
      );

      if (!localUser) {
        this.logger.warn(
          "Rejected websocket connection because the Clerk user is not synced locally",
          {
            clientId: client.id,
            clerkUserId: auth.userId,
          },
        );
        next(new Error("User is not synced locally"));
        return;
      }

      client.data.auth = auth;
      client.data.userId = localUser.id;
      client.data.localUser = localUser satisfies SocketLocalUserContext;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      this.logger.warn(
        "Rejected websocket connection with invalid Clerk token",
        {
          clientId: client.id,
          message,
        },
      );

      next(new Error("Unauthorized"));
    }
  }

  @SubscribeMessage("stream:start")
  async handleStreamStart(
    client: Socket,
    payload: StreamStartDto,
  ): Promise<WsResponse<StreamStartAck>> {
    const actor = this.getStreamActor(client);

    return {
      event: "stream:ack",
      data: await this.audioStreamService.beginStream(
        client.id,
        actor,
        payload,
      ),
    };
  }

  @SubscribeMessage("stream:chunk")
  handleStreamChunk(
    client: Socket,
    payload: AudioChunkDto,
  ): WsResponse<StreamChunkAck> {
    const actor = this.getStreamActor(client);

    return {
      event: "stream:chunk:ack",
      data: this.audioStreamService.handleChunk(client.id, actor, payload),
    };
  }

  @SubscribeMessage("stream:ready")
  async handleStreamReady(
    client: Socket,
    payload: StreamReadyDto,
  ): Promise<WsResponse<StreamReadyAck>> {
    const actor = this.getStreamActor(client);

    return {
      event: "stream:ready:ack",
      data: await this.audioStreamService.markStreamReady(
        client.id,
        actor,
        payload,
      ),
    };
  }

  @SubscribeMessage("stream:stop")
  async handleStreamStop(
    client: Socket,
    payload: StreamStopDto,
  ): Promise<WsResponse<StreamStopAck>> {
    const actor = this.getStreamActor(client);

    return {
      event: "stream:stop:ack",
      data: await this.audioStreamService.stopStream(client.id, actor, payload),
    };
  }

  private getStreamActor(client: Socket) {
    const clerkUserId = client.data.auth?.userId;
    const localUserId = client.data.userId;

    if (!clerkUserId || !localUserId) {
      throw new Error("Authenticated stream actor context is missing.");
    }

    return {
      clerkUserId,
      localUserId,
    };
  }
}
