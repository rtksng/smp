import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateWarehouseDto, UpdateWarehouseDto, WarehouseListQueryDto } from "../../src/modules/warehouses/dto/warehouse.dto";

const input = {
  address: " Plot 1 ", city: " Pune ", code: " qa-1 ", contactNumber: "9000000000",
  contactPerson: " QA ", name: " Warehouse ", pincode: "411001", state: " Maharashtra "
};

test("warehouse input normalizes required text and preserves a one-character existing code", async () => {
  const dto = plainToInstance(CreateWarehouseDto, { ...input, status: "INACTIVE" });
  assert.deepEqual(await validate(dto), []);
  assert.equal(dto.code, "QA-1");
  assert.equal(dto.city, "Pune");
  assert.equal(dto.status, "INACTIVE");
  assert.deepEqual(await validate(plainToInstance(UpdateWarehouseDto, { code: "1" })), []);
});

test("required warehouse fields reject whitespace and null on create and update", async () => {
  for (const field of ["address", "city", "code", "contactPerson", "name", "pincode", "state", "contactNumber"]) {
    for (const value of ["", "   ", null]) {
      assert.ok((await validate(plainToInstance(CreateWarehouseDto, { ...input, [field]: value }))).length, `${field}: ${value}`);
      assert.ok((await validate(plainToInstance(UpdateWarehouseDto, { [field]: value }))).length, `${field}: ${value}`);
    }
  }
  assert.deepEqual(await validate(plainToInstance(UpdateWarehouseDto, {})), []);
  for (const status of [null, "INVALID", ""]) {
    assert.ok((await validate(plainToInstance(UpdateWarehouseDto, { status }))).length);
  }
});

test("warehouse coordinates accept null to clear but reject booleans, blanks, range and precision errors", async () => {
  for (const latitude of [true, false, "", " ", 91, -91, 0.00000001, "abc"]) {
    assert.ok((await validate(plainToInstance(UpdateWarehouseDto, { latitude }))).length, String(latitude));
  }
  const dto = plainToInstance(UpdateWarehouseDto, { latitude: "18.5204", longitude: null });
  assert.deepEqual(await validate(dto), []);
  assert.equal(dto.latitude, 18.5204);
  assert.equal(dto.longitude, null);
  for (const contactNumber of ["++++++++", "(---)---", "12 34 56"]) {
    assert.ok((await validate(plainToInstance(UpdateWarehouseDto, { contactNumber }))).length);
  }
});

test("warehouse pagination accepts integer query strings and rejects fractions and invalid bounds", async () => {
  assert.deepEqual(await validate(plainToInstance(WarehouseListQueryDto, { page: "2", limit: "100" })), []);
  for (const page of [0, -1, 1.5, true, "", 1e20]) {
    assert.ok((await validate(plainToInstance(WarehouseListQueryDto, { page }))).length, String(page));
  }
  for (const limit of [0, 1.5, 101, false]) {
    assert.ok((await validate(plainToInstance(WarehouseListQueryDto, { limit }))).length, String(limit));
  }
});
