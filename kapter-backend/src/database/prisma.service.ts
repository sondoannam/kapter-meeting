import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { appConfig } from "src/config/app.config";
import { ConfigType } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {
    const pool = new PrismaPg({ connectionString: config.databaseUrl });
    super({ adapter: pool });
  }
  async onModuleInit() {
    this.logger.info("PrismaService is initializing...");
    await this.$connect();
  }
}
