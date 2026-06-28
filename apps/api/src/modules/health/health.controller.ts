import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { API_VERSION_PREFIX, APP_NAMES } from "@surgical/config";
import type { HealthResponse } from "@surgical/types";
import {
  HealthReadinessResponse,
  HealthReadinessService
} from "./health-readiness.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthReadinessService)
    private readonly readinessService: HealthReadinessService
  ) {}

  @ApiOperation({ summary: "Check API health" })
  @Get()
  check(): HealthResponse {
    return this.liveness();
  }

  @ApiOperation({ summary: "Check API liveness" })
  @Get("live")
  liveness(): HealthResponse {
    return {
      service: APP_NAMES.api,
      status: "ok",
      timestamp: new Date().toISOString(),
      versionPrefix: API_VERSION_PREFIX
    };
  }

  @ApiOperation({ summary: "Check API dependency readiness" })
  @Get("ready")
  async readiness(): Promise<HealthReadinessResponse> {
    const readiness = await this.readinessService.check();

    if (readiness.status !== "ready") {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
