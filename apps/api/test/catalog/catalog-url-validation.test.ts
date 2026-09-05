import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateBrandDto } from "../../src/modules/brands/dto/create-brand.dto";
import { UpdateBrandDto } from "../../src/modules/brands/dto/update-brand.dto";
import { CreateCategoryDto } from "../../src/modules/categories/dto/create-category.dto";
import {
  ProductDocumentInputDto,
  ProductImageInputDto
} from "../../src/modules/products/dto/product-input.dto";

test("admin catalog asset DTOs accept local upload URLs with a protocol", async () => {
  const image = Object.assign(new ProductImageInputDto(), {
    url: "http://localhost:4000/uploads/catalog/products/images/main.png"
  });
  const document = Object.assign(new ProductDocumentInputDto(), {
    fileKey: "catalog/products/documents/manual.pdf",
    fileUrl: "http://localhost:4000/uploads/catalog/products/documents/manual.pdf",
    title: "Manual",
    type: "MANUAL"
  });
  const category = Object.assign(new CreateCategoryDto(), {
    imageUrl: "http://localhost:4000/uploads/catalog/categories/images/main.png",
    name: "Surgical Instruments",
    slug: "surgical-instruments"
  });
  const brand = Object.assign(new CreateBrandDto(), {
    logoUrl: "http://localhost:4000/uploads/catalog/brands/logos/main.png",
    name: "Acme Surgical",
    slug: "acme-surgical"
  });

  assert.equal((await validate(image)).length, 0);
  assert.equal((await validate(document)).length, 0);
  assert.equal((await validate(category)).length, 0);
  assert.equal((await validate(brand)).length, 0);
});

test("admin product asset DTOs still reject protocol-less URLs", async () => {
  const image = Object.assign(new ProductImageInputDto(), {
    url: "localhost:4000/uploads/catalog/products/images/main.png"
  });
  const document = Object.assign(new ProductDocumentInputDto(), {
    fileKey: "catalog/products/documents/manual.pdf",
    fileUrl: "localhost:4000/uploads/catalog/products/documents/manual.pdf",
    title: "Manual",
    type: "MANUAL"
  });

  assert.match(JSON.stringify(await validate(image)), /url must be a URL address/);
  assert.match(
    JSON.stringify(await validate(document)),
    /fileUrl must be a URL address/
  );
});

test("brand DTOs normalize text and reject whitespace-only names", async () => {
  const brand = plainToInstance(CreateBrandDto, {
    description: "  Trusted surgical supplier.  ",
    logoUrl: "  http://localhost:4000/uploads/catalog/brands/logos/main.png  ",
    name: "  Acme Surgical  ",
    slug: "  acme-surgical  "
  });

  assert.deepEqual(await validate(brand), []);
  assert.equal(brand.description, "Trusted surgical supplier.");
  assert.equal(
    brand.logoUrl,
    "http://localhost:4000/uploads/catalog/brands/logos/main.png"
  );
  assert.equal(brand.name, "Acme Surgical");
  assert.equal(brand.slug, "acme-surgical");

  const blankCreate = plainToInstance(CreateBrandDto, {
    description: "   ",
    logoUrl: "   ",
    name: "   ",
    slug: "brand"
  });
  const blankUpdate = plainToInstance(UpdateBrandDto, { name: "   " });

  assert.ok((await validate(blankCreate)).length > 0);
  assert.equal(blankCreate.description, null);
  assert.equal(blankCreate.logoUrl, null);
  assert.ok((await validate(blankUpdate)).length > 0);
});
