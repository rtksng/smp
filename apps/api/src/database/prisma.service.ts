import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function createPrismaAdapter(configService: ConfigService) {
  const connectionString = configService.get<string>("DATABASE_URL");

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Prisma.");
  }

  return new PrismaPg({ connectionString });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    super({ adapter: createPrismaAdapter(configService) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
