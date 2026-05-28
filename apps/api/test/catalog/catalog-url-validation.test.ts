import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { validate } from "class-validator";
import { CreateBrandDto } from "../../src/modules/brands/dto/create-brand.dto";
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
