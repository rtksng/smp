import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test as NestTest } from "@nestjs/testing";
import { API_VERSION_PREFIX, APP_NAMES } from "@surgical/config";
import request from "supertest";
import { HealthController } from "../../src/modules/health/health.controller";
import { HealthReadinessService } from "../../src/modules/health/health-readiness.service";

let app: INestApplication;

before(async () => {
  const moduleRef = await NestTest.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: HealthReadinessService,
        useValue: {
          check: async () => ({
            checks: {
              database: "ok",
              redis: "ok"
            },
            service: APP_NAMES.api,
            status: "ready",
            timestamp: new Date().toISOString(),
            versionPrefix: API_VERSION_PREFIX
          })
        }
      }
    ]
  }).compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix(API_VERSION_PREFIX);
  await app.init();
});

after(async () => {
  await app.close();
});

test("GET /api/v1/health returns service health over HTTP", async () => {
  const response = await request(app.getHttpServer())
    .get(`${API_VERSION_PREFIX}/health`)
    .expect(200);

  assert.equal(response.body.service, APP_NAMES.api);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.versionPrefix, API_VERSION_PREFIX);
  assert.equal(typeof response.body.timestamp, "string");
});

test("GET /api/v1/health/live returns liveness over HTTP", async () => {
  const response = await request(app.getHttpServer())
    .get(`${API_VERSION_PREFIX}/health/live`)
    .expect(200);

  assert.equal(response.body.service, APP_NAMES.api);
  assert.equal(response.body.status, "ok");
});

test("GET /api/v1/health/ready returns dependency readiness over HTTP", async () => {
  const response = await request(app.getHttpServer())
    .get(`${API_VERSION_PREFIX}/health/ready`)
    .expect(200);

  assert.equal(response.body.service, APP_NAMES.api);
  assert.equal(response.body.status, "ready");
  assert.deepEqual(response.body.checks, {
    database: "ok",
    redis: "ok"
  });
});
