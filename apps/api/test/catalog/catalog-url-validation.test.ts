import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateBrandDto } from "../../src/modules/brands/dto/create-brand.dto";
import { UpdateBrandDto } from "../../src/modules/brands/dto/update-brand.dto";
import { CreateCategoryDto } from "../../src/modules/categories/dto/create-category.dto";
import { UpdateCategoryDto } from "../../src/modules/categories/dto/update-category.dto";
import { CreateProductDto } from "../../src/modules/products/dto/create-product.dto";
import {
  ProductDocumentInputDto,
  ProductImageInputDto,
  ProductVariantInputDto
} from "../../src/modules/products/dto/product-input.dto";
import { UpdateProductDto } from "../../src/modules/products/dto/update-product.dto";

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

test("category DTOs normalize text and reject whitespace-only names", async () => {
  const category = plainToInstance(CreateCategoryDto, {
    description: "  Operating room equipment.  ",
    imageUrl: "  http://localhost:4000/uploads/catalog/categories/images/main.png  ",
    name: "  Operating Room  ",
    parentId: "  7d9f8f33-d348-4a89-94e8-907be76a91c6  ",
    slug: "  operating-room  "
  });

  assert.deepEqual(await validate(category), []);
  assert.equal(category.description, "Operating room equipment.");
  assert.equal(
    category.imageUrl,
    "http://localhost:4000/uploads/catalog/categories/images/main.png"
  );
  assert.equal(category.name, "Operating Room");
  assert.equal(category.parentId, "7d9f8f33-d348-4a89-94e8-907be76a91c6");
  assert.equal(category.slug, "operating-room");

  const blankCreate = plainToInstance(CreateCategoryDto, {
    description: "   ",
    imageUrl: "   ",
    name: "   ",
    parentId: "   ",
    slug: "category"
  });
  const blankUpdate = plainToInstance(UpdateCategoryDto, { name: "   " });

  assert.ok((await validate(blankCreate)).length > 0);
  assert.equal(blankCreate.description, null);
  assert.equal(blankCreate.imageUrl, null);
  assert.equal(blankCreate.parentId, null);
  assert.ok((await validate(blankUpdate)).length > 0);
});

test("product DTOs normalize nested text and reject whitespace-only required values", async () => {
  const product = plainToInstance(CreateProductDto, {
    basePrice: 100,
    brandId: "  7d9f8f33-d348-4a89-94e8-907be76a91c6  ",
    categoryId: "  cdbf28c6-6696-4de7-b4d3-a20f39d2c06e  ",
    description: "  Reusable surgical instrument.  ",
    disposable: false,
    documents: [
      {
        fileKey: "  catalog/products/documents/manual.pdf  ",
        fileUrl: "  http://localhost:4000/uploads/catalog/products/documents/manual.pdf  ",
        title: "  Product manual  ",
        type: "MANUAL"
      }
    ],
    expirySensitive: false,
    images: [
      {
        altText: "   ",
        url: "  http://localhost:4000/uploads/catalog/products/images/main.png  "
      }
    ],
    material: "   ",
    medicalSpecialty: "  General Surgery  ",
    metaDescription: "   ",
    metaTitle: "  Surgical Instrument  ",
    mrp: 150,
    name: "  Surgical Instrument  ",
    packSize: "   ",
    searchTags: ["  instrument  ", "", "  reusable  "],
    sellingPrice: 120,
    shortDescription: "  Reusable instrument.  ",
    sku: "  INSTRUMENT-001  ",
    slug: "  surgical-instrument  ",
    status: "ACTIVE",
    sterile: true,
    subcategoryId: "  10b142a8-2a82-4c67-b929-835b04c48bda  ",
    taxRate: 18,
    unit: "  piece  ",
    variants: [
      {
        attributes: { size: "standard" },
        mrp: 175,
        name: "  Standard  ",
        sellingPrice: 140,
        sku: "  INSTRUMENT-001-STD  "
      }
    ]
  });

  assert.deepEqual(await validate(product), []);
  assert.equal(product.name, "Surgical Instrument");
  assert.equal(product.description, "Reusable surgical instrument.");
  assert.equal(product.material, null);
  assert.equal(product.medicalSpecialty, "General Surgery");
  assert.equal(product.metaDescription, null);
  assert.equal(product.packSize, null);
  assert.deepEqual(product.searchTags, ["instrument", "reusable"]);
  assert.equal(product.images?.[0]?.altText, null);
  assert.equal(
    product.images?.[0]?.url,
    "http://localhost:4000/uploads/catalog/products/images/main.png"
  );
  assert.equal(product.documents?.[0]?.title, "Product manual");
  assert.equal(product.variants?.[0]?.name, "Standard");
  assert.equal(product.unit, "piece");

  const blankCreate = plainToInstance(CreateProductDto, {
    basePrice: 0,
    brandId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    categoryId: "cdbf28c6-6696-4de7-b4d3-a20f39d2c06e",
    description: "   ",
    disposable: false,
    expirySensitive: false,
    mrp: 0,
    name: "   ",
    sellingPrice: 0,
    shortDescription: "   ",
    sku: "VALID-001",
    slug: "valid-product",
    status: "DRAFT",
    sterile: false,
    taxRate: 0,
    unit: ""
  });
  const blankUpdate = plainToInstance(UpdateProductDto, { name: "   " });

  assert.ok((await validate(blankCreate)).length >= 3);
  assert.ok((await validate(blankUpdate)).length > 0);
});

test("nested product DTOs reject whitespace-only required text", async () => {
  const image = plainToInstance(ProductImageInputDto, { url: "   " });
  const document = plainToInstance(ProductDocumentInputDto, {
    fileKey: "   ",
    fileUrl: "   ",
    title: "   ",
    type: "MANUAL"
  });
  const variant = plainToInstance(ProductVariantInputDto, {
    attributes: {},
    mrp: 10,
    name: "   ",
    sellingPrice: 9,
    sku: "   "
  });

  assert.ok((await validate(image)).length > 0);
  assert.ok((await validate(document)).length >= 3);
  assert.ok((await validate(variant)).length >= 2);
});
