import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthReadinessService } from "./health-readiness.service";

@Module({
  controllers: [HealthController],
  providers: [HealthReadinessService]
})
export class HealthModule {}
