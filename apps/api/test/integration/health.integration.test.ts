import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test as NestTest } from "@nestjs/testing";
import { API_VERSION_PREFIX, APP_NAMES } from "@surgical/config";
import request from "supertest";
import { HealthModule } from "../../src/modules/health/health.module";

let app: INestApplication;

before(async () => {
  const moduleRef = await NestTest.createTestingModule({
    imports: [HealthModule]
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
