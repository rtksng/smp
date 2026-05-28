import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { API_VERSION_PREFIX, APP_NAMES } from "@surgical/config";
import type { HealthResponse } from "@surgical/types";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @ApiOperation({ summary: "Check API health" })
  @Get()
  check(): HealthResponse {
    return {
      service: APP_NAMES.api,
      status: "ok",
      timestamp: new Date().toISOString(),
      versionPrefix: API_VERSION_PREFIX
    };
  }
}
