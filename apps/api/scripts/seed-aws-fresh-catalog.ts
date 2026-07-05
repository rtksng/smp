import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConnectionOptions } from "node:tls";
import { deflateSync } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AddressType,
  AdminStatus,
  CouponType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  StockMovementType,
  WarehouseStatus
} from "../src/generated/prisma/enums";
import { PrismaClient } from "../src/generated/prisma/client";
import { AdminRoleCode } from "../src/modules/roles/roles.constants";
import {
  CATALOG_CATEGORY_TREE,
  seedAccessControl,
  seedCatalogBrands,
  seedCatalogCategories
} from "../prisma/seed";

type BrandSeed = {
  description: string;
  name: string;
  slug: string;
};

type ProductSeed = {
  brandSlug: string;
  categorySlug: string;
  disposable: boolean;
  expirySensitive: boolean;
  material: string;
  medicalSpecialty: string;
  name: string;
  packSize: string;
  sterile: boolean;
  subcategorySlug?: string;
  unit: string;
};

type UploadedImages = {
  brands: Map<string, string>;
  categories: Map<string, string>;
  products: Map<string, string[]>;
};

const API_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const DEMO_PREFIX = "aws-demo";
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 900;
const PRODUCT_IMAGE_COUNT = 3;

const EXTRA_BRANDS: BrandSeed[] = [
  {
    description:
      "Global medical device manufacturer focused on operating room, catheterization and patient monitoring workflows.",
    name: "Medtronic",
    slug: "medtronic"
  },
  {
    description:
      "Hospital consumables, infusion therapy, wound care and sterile procedure supplies for clinical teams.",
    name: "B. Braun",
    slug: "b-braun"
  },
  {
    description:
      "Advanced wound management, orthopaedic implants and surgical support products for hospitals.",
    name: "Smith & Nephew",
    slug: "smith-nephew"
  },
  {
    description:
      "Infection prevention, medical tapes, dressings and reliable day-to-day clinical consumables.",
    name: "3M Health Care",
    slug: "3m-health-care"
  },
  {
    description:
      "Indian hospital supplies brand covering tubes, catheters, respiratory care and procedure kits.",
    name: "Romsons",
    slug: "romsons"
  },
  {
    description:
      "Infusion, access, dialysis and disposable medical products for multi-specialty healthcare providers.",
    name: "Polymed",
    slug: "polymed"
  },
  {
    description:
      "Medical equipment brand for diagnostic, monitoring and critical-care environments.",
    name: "BPL Medical",
    slug: "bpl-medical"
  },
  {
    description:
      "Home and clinical diagnostics focused on blood pressure, nebulization and patient vitals.",
    name: "Omron Healthcare",
    slug: "omron-healthcare"
  },
  {
    description:
      "Diagnostic imaging and laboratory equipment supplier for hospitals and diagnostic chains.",
    name: "Siemens Healthineers",
    slug: "siemens-healthineers"
  },
  {
    description:
      "Diagnostics and point-of-care testing brand used by clinics, labs and hospital departments.",
    name: "Roche Diagnostics",
    slug: "roche-diagnostics"
  }
];

const PRODUCTS: ProductSeed[] = [
  product("Disposable Sterile Syringe 5 ml", "romsons", "consumables", "medical-consumables", "Polypropylene", "Pack of 100", "piece", true, true, true, "General Medicine"),
  product("Latex Examination Gloves Medium", "3m-health-care", "consumables", "hygiene-control", "Natural latex", "Box of 100", "box", false, true, true, "Infection Control"),
  product("Nitrile Powder Free Gloves Large", "polymed", "consumables", "hygiene-control", "Nitrile", "Box of 100", "box", false, true, true, "Infection Control"),
  product("Sterile Gauze Swabs 10 x 10 cm", "healthium", "consumables", "bandages-wound", "Cotton gauze", "Pack of 100", "pack", true, true, true, "Wound Care"),
  product("Absorbent Cotton Roll 500 g", "mb-plus", "consumables", "bandages-wound", "Medical grade cotton", "500 g roll", "roll", false, true, false, "Nursing"),
  product("IV Cannula 20G With Wings", "polymed", "consumables", "catheters", "FEP catheter", "Box of 50", "box", true, true, true, "Emergency Care"),
  product("Foley Balloon Catheter 16 Fr", "romsons", "consumables", "catheters", "Silicone coated latex", "Pack of 10", "pack", true, true, true, "Urology"),
  product("Three Way Stopcock With Extension", "b-braun", "consumables", "medical-consumables", "Medical polymer", "Pack of 50", "pack", true, true, true, "Critical Care"),
  product("Surgical Disposable Gown XL", "healthium", "consumables", "gown-drapes", "SMS non-woven fabric", "Pack of 10", "pack", true, true, true, "Surgery"),
  product("Universal Surgical Drape Set", "3m-health-care", "consumables", "gown-drapes", "Laminated non-woven", "Procedure kit", "kit", true, true, true, "Operating Room"),
  product("Digital Blood Pressure Monitor Pro", "omron-healthcare", "equipment", "general-physician", "ABS housing", "Single unit", "unit", false, false, false, "General Physician"),
  product("Multi Parameter Patient Monitor 12 inch", "bpl-medical", "equipment", "critical-care", "Medical grade ABS", "Single unit", "unit", false, false, false, "Critical Care"),
  product("ICU Ventilator Circuit Adult", "medtronic", "equipment", "critical-care", "Corrugated medical polymer", "Pack of 10", "pack", true, true, true, "Respiratory Care"),
  product("Nebulizer Compressor Kit", "omron-healthcare", "equipment", "mother-and-child", "ABS compressor body", "Single kit", "kit", false, false, false, "Respiratory Care"),
  product("Hospital Fowler Bed Manual", "mb-plus", "equipment", "hospital-furniture", "Powder coated steel", "Single bed", "unit", false, false, false, "Hospital Furniture"),
  product("LED OT Light Ceiling Mount", "bpl-medical", "equipment", "surgery", "Aluminium alloy", "Single unit", "unit", false, false, false, "Operating Room"),
  product("Autoclave Sterilizer 35 L", "siemens-healthineers", "equipment", "cssd", "Stainless steel", "Single unit", "unit", false, false, false, "CSSD"),
  product("Infusion Pump Precision Flow", "b-braun", "equipment", "critical-care", "Medical grade polymer", "Single unit", "unit", false, false, false, "Critical Care"),
  product("Portable ECG Machine 12 Channel", "bpl-medical", "cardiology", "accessories", "ABS casing", "Single unit", "unit", false, false, false, "Cardiology"),
  product("Pulse Oximeter Fingertip Clinical", "contec", "equipment", "general-physician", "ABS sensor housing", "Single unit", "unit", false, false, false, "General Physician"),
  product("Endodontic Rotary File Assortment", "gc", "dental", "endodontics", "NiTi alloy", "Pack of 6", "pack", true, true, false, "Dental"),
  product("Dental Composite Restorative Kit", "gc", "dental", "restoratives", "Resin composite", "Starter kit", "kit", false, false, true, "Dental"),
  product("Alginate Impression Material Fast Set", "orikam", "dental", "impression-materials", "Alginate powder", "450 g pouch", "pouch", false, true, true, "Dental"),
  product("Dental Air Rotor Cartridge", "orikam", "dental", "small-equipment", "Stainless steel", "Single unit", "unit", false, false, false, "Dental"),
  product("Orthodontic Bracket Kit MBT", "gc", "dental", "orthodontics", "Stainless steel", "Case kit", "kit", false, true, false, "Orthodontics"),
  product("Blood Glucose Test Strips 50", "abbott", "diagnostics", "point-of-care-testing-poct", "Enzyme reagent strip", "Box of 50", "box", false, true, true, "Diagnostics"),
  product("Hemoglobin Test Meter Kit", "roche-diagnostics", "diagnostics", "equipment-accessories", "ABS meter body", "Single kit", "kit", false, false, false, "Diagnostics"),
  product("Rapid Malaria Antigen Test Card", "j-mitra", "diagnostics", "rapid-cards", "Immunochromatographic membrane", "Box of 25", "box", false, true, true, "Diagnostics"),
  product("Vacuum Blood Collection Tube EDTA", "b-braun", "diagnostics", "phlebotomy", "PET tube", "Pack of 100", "pack", true, true, true, "Diagnostics"),
  product("Serology Reagent Control Kit", "roche-diagnostics", "diagnostics", "serology", "Liquid reagent", "Kit", "kit", false, true, true, "Laboratory"),
  product("Dialysis Blood Tubing Set Adult", "polymed", "nephrology", "blood-tubing-sets", "Medical grade PVC", "Pack of 10", "pack", true, true, true, "Nephrology"),
  product("High Flux Dialyzer 1.8 sqm", "b-braun", "nephrology", "dialyzers", "Polysulfone membrane", "Single unit", "unit", true, true, true, "Nephrology"),
  product("Hemodialysis Catheter Double Lumen", "medtronic", "nephrology", "dialysis-catheters", "Polyurethane", "Single sterile kit", "kit", true, true, true, "Nephrology"),
  product("Dialysis Disinfectant Solution 5 L", "b-braun", "nephrology", "dialysis-disinfectants", "Peracetic acid blend", "5 L can", "can", false, true, true, "Nephrology"),
  product("Fistula Needle 16G Rotating Wing", "polymed", "nephrology", "fistula-needles", "Stainless steel needle", "Box of 50", "box", true, true, true, "Nephrology"),
  product("Coronary Guide Wire Hydrophilic", "medtronic", "cardiology", "guide-wire", "Nitinol core", "Single sterile unit", "unit", true, true, true, "Interventional Cardiology"),
  product("Introducer Sheath 6F Radial", "medtronic", "cardiology", "introducer-sheath", "PTFE lined sheath", "Single kit", "kit", true, true, true, "Interventional Cardiology"),
  product("PTCA Balloon Dilatation Catheter", "medtronic", "cardiology", "sc-ptca-balloon-dilatation-catheter", "Polyamide balloon", "Single sterile unit", "unit", true, true, true, "Interventional Cardiology"),
  product("Aspiration Catheter Thrombus Kit", "medtronic", "cardiology", "aspiration-catheter", "Braided polymer shaft", "Single kit", "kit", true, true, true, "Interventional Cardiology"),
  product("Peripheral Drug Eluting Balloon", "medtronic", "cardiology", "peripheral-drug-eluting-balloon", "Drug coated balloon", "Single sterile unit", "unit", true, true, true, "Vascular Surgery"),
  product("Ophthalmic Slit Lamp Portable", "volk", "ophthalmology", "diagnostic-equipment", "Aluminium optical body", "Single unit", "unit", false, false, false, "Ophthalmology"),
  product("Indirect Ophthalmoscopy Lens 20D", "volk", "ophthalmology", "diagnostic-lenses", "Optical glass", "Single lens", "unit", false, false, false, "Ophthalmology"),
  product("Sterile Ophthalmic Drape Pack", "healthium", "ophthalmology", "ophthalmic-consumables", "Lint-free non-woven", "Pack of 10", "pack", true, true, true, "Ophthalmology"),
  product("Cataract Surgical Instrument Set", "healthium", "ophthalmology", "surgical-instruments-and-kits", "German stainless steel", "Instrument kit", "kit", true, false, false, "Ophthalmology"),
  product("Knee Immobilizer Universal", "mb-plus", "physiotherapy", "knee-support", "Foam and aluminium stays", "Single unit", "unit", false, false, false, "Physiotherapy"),
  product("Cervical Collar Soft Medium", "mb-plus", "physiotherapy", "cervical-aids", "PU foam", "Single unit", "unit", false, false, false, "Physiotherapy"),
  product("Compression Stocking Class 2", "mb-plus", "physiotherapy", "compression-stockings", "Nylon elastane", "Pair", "pair", false, false, false, "Physiotherapy"),
  product("Ankle Binder Elastic Support", "mb-plus", "physiotherapy", "ankle-supports", "Elastic cotton blend", "Single unit", "unit", false, false, false, "Physiotherapy"),
  product("IVF Embryo Transfer Catheter", "polymed", "ivf-gynae", "iui-ivf", "Medical polymer", "Single sterile unit", "unit", true, true, true, "IVF/Gynae"),
  product("Endometrial Biopsy Cannula", "romsons", "ivf-gynae", "biopsy-sampling", "Polypropylene", "Pack of 10", "pack", true, true, true, "IVF/Gynae")
];

const WAREHOUSES = [
  {
    address: "Plot 42, Andheri East Medical Logistics Park",
    city: "Mumbai",
    code: "AWS-MUM-01",
    contactNumber: "+912240010001",
    contactPerson: "Aarav Mehta",
    name: "Mumbai Central Fulfilment Hub",
    pincode: "400059",
    state: "Maharashtra"
  },
  {
    address: "Survey 18, Whitefield Healthcare Supply Zone",
    city: "Bengaluru",
    code: "AWS-BLR-01",
    contactNumber: "+918040010002",
    contactPerson: "Nisha Rao",
    name: "Bengaluru South Clinical Warehouse",
    pincode: "560066",
    state: "Karnataka"
  },
  {
    address: "Block C, Okhla Industrial Medical Estate",
    city: "Delhi",
    code: "AWS-DEL-01",
    contactNumber: "+911140010003",
    contactPerson: "Kabir Malhotra",
    name: "Delhi NCR Hospital Supply Depot",
    pincode: "110020",
    state: "Delhi"
  },
  {
    address: "Warehouse 7, GIDC Pharma Logistics Cluster",
    city: "Ahmedabad",
    code: "AWS-AMD-01",
    contactNumber: "+917940010004",
    contactPerson: "Isha Patel",
    name: "Ahmedabad West Medical Stores",
    pincode: "382445",
    state: "Gujarat"
  }
] as const;

const CUSTOMERS = [
  ["Aarogya Multispeciality Hospital", "Rohan", "Desai", "9876500001", "Mumbai", "Maharashtra", "400053"],
  ["Sunrise Dental & Implant Centre", "Meera", "Kapoor", "9876500002", "Delhi", "Delhi", "110024"],
  ["Lotus Diagnostics Lab", "Ankit", "Sinha", "9876500003", "Bengaluru", "Karnataka", "560037"],
  ["Carewell Kidney Centre", "Neha", "Nair", "9876500004", "Kochi", "Kerala", "682020"],
  ["Pragati Cardiac Clinic", "Dev", "Shah", "9876500005", "Ahmedabad", "Gujarat", "380015"],
  ["Nayan Eye Hospital", "Tara", "Joshi", "9876500006", "Pune", "Maharashtra", "411045"],
  ["Healplus Physiotherapy Studio", "Kunal", "Verma", "9876500007", "Jaipur", "Rajasthan", "302001"],
  ["Bloom IVF Centre", "Sana", "Khan", "9876500008", "Hyderabad", "Telangana", "500081"]
] as const;

const COUPONS = [
  { code: "AWSWELCOME10", maxDiscount: "1500.00", minOrderAmount: "5000.00", type: CouponType.PERCENTAGE, value: "10.00" },
  { code: "CLINIC500", maxDiscount: null, minOrderAmount: "4000.00", type: CouponType.FIXED_AMOUNT, value: "500.00" },
  { code: "BULKMED7", maxDiscount: "2500.00", minOrderAmount: "15000.00", type: CouponType.PERCENTAGE, value: "7.00" },
  { code: "SURGICAL1000", maxDiscount: null, minOrderAmount: "10000.00", type: CouponType.FIXED_AMOUNT, value: "1000.00" }
] as const;

function product(
  name: string,
  brandSlug: string,
  categorySlug: string,
  subcategorySlug: string | undefined,
  material: string,
  packSize: string,
  unit: string,
  sterile: boolean,
  disposable: boolean,
  expirySensitive: boolean,
  medicalSpecialty: string
): ProductSeed {
  return {
    brandSlug,
    categorySlug,
    disposable,
    expirySensitive,
    material,
    medicalSpecialty,
    name,
    packSize,
    sterile,
    subcategorySlug,
    unit
  };
}

function loadEnvironment() {
  dotenv.config({ path: path.join(REPO_ROOT, ".env") });
  dotenv.config({ path: path.join(API_ROOT, ".env") });
  dotenv.config({ path: path.join(REPO_ROOT, ".env.seed.local"), override: true });
  dotenv.config({ path: path.join(API_ROOT, ".env.seed.local"), override: true });
  dotenv.config();
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`${names.join(" or ")} is required.`);
}

function optionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function createPrismaClient() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const pgConfig: {
    connectionString: string;
    ssl?: boolean | ConnectionOptions;
  } = {
    connectionString: databaseUrlForPg(databaseUrl)
  };
  const ssl = rdsSslConfig(databaseUrl);

  if (ssl) {
    pgConfig.ssl = ssl;
  }

  return new PrismaClient({
    adapter: new PrismaPg(pgConfig)
  });
}

function databaseUrlForPg(rawUrl: string) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");

  return url.toString();
}

function rdsSslConfig(rawUrl: string): ConnectionOptions | undefined {
  const url = new URL(rawUrl);

  if (!url.hostname.endsWith(".rds.amazonaws.com")) {
    return undefined;
  }

  return {
    ca: readRdsCaBundle(),
    rejectUnauthorized: true,
    servername: url.hostname
  };
}

function readRdsCaBundle() {
  const explicitPath =
    optionalEnv("RDS_SSL_CA_FILE", "PGSSLROOTCERT", "NODE_EXTRA_CA_CERTS") ??
    "";
  const candidates = [
    explicitPath,
    path.join(process.cwd(), "global-bundle.pem"),
    path.join(REPO_ROOT, "global-bundle.pem"),
    path.join(REPO_ROOT, "tmp", "aws-rds", "global-bundle.pem"),
    path.join(API_ROOT, "global-bundle.pem")
  ].filter(Boolean);
  const certificatePath = candidates.find((candidate) => existsSync(candidate));

  if (!certificatePath) {
    throw new Error(
      `AWS RDS CA bundle was not found. Download it with: curl -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`
    );
  }

  return readFileSync(certificatePath, "utf8");
}

function createS3Client() {
  return new S3Client({
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY")
    },
    endpoint: optionalEnv("S3_ENDPOINT", "AWS_S3_ENDPOINT"),
    forcePathStyle: optionalEnv("S3_FORCE_PATH_STYLE") === "true",
    region: requiredEnv("S3_REGION", "AWS_REGION")
  });
}

async function uploadPngToS3(
  s3: S3Client,
  key: string,
  buffer: Buffer
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Body: buffer,
      Bucket: requiredEnv("S3_BUCKET", "AWS_S3_BUCKET"),
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: "image/png",
      Key: key
    })
  );

  return `${publicBaseUrl()}/${key}`;
}

function publicBaseUrl() {
  return requiredEnv(
    "STORAGE_PUBLIC_BASE_URL",
    "AWS_S3_PUBLIC_URL",
    "NEXT_PUBLIC_STORAGE_PUBLIC_URL"
  ).replace(/\/+$/, "");
}

async function uploadSeedImages(s3: S3Client): Promise<UploadedImages> {
  const brands = new Map<string, string>();
  const categories = new Map<string, string>();
  const products = new Map<string, string[]>();
  const allBrandSlugs = [...new Set(PRODUCTS.map((item) => item.brandSlug))];
  const allCategorySlugs = CATALOG_CATEGORY_TREE.flatMap((category) => [
    category.slug,
    ...category.subcategories.map((subcategory) => subcategory.slug)
  ]);

  for (const slug of allBrandSlugs) {
    const key = `catalog/brands/logos/${DEMO_PREFIX}/${slug}.png`;
    const image = createSeedImage({ label: slug, kind: "brand", seed: slug });
    brands.set(slug, await uploadPngToS3(s3, key, image));
  }

  for (const slug of allCategorySlugs) {
    const key = `catalog/categories/images/${DEMO_PREFIX}/${slug}.png`;
    const image = createSeedImage({ label: slug, kind: "category", seed: slug });
    categories.set(slug, await uploadPngToS3(s3, key, image));
  }

  for (const item of PRODUCTS) {
    const slug = slugify(item.name);
    const urls: string[] = [];

    for (let index = 0; index < PRODUCT_IMAGE_COUNT; index += 1) {
      const key = `catalog/products/images/${DEMO_PREFIX}/${slug}-${index + 1}.png`;
      const image = createSeedImage({
        label: item.name,
        kind: "product",
        seed: `${slug}-${index}`,
        variant: index
      });
      urls.push(await uploadPngToS3(s3, key, image));
    }

    products.set(slug, urls);
  }

  return {
    brands,
    categories,
    products
  };
}

async function seedBrands(prisma: PrismaClient, images: UploadedImages) {
  for (const brand of EXTRA_BRANDS) {
    await prisma.brand.upsert({
      create: {
        description: brand.description,
        isActive: true,
        logoUrl: images.brands.get(brand.slug),
        name: brand.name,
        slug: brand.slug
      },
      update: {
        deletedAt: null,
        description: brand.description,
        isActive: true,
        logoUrl: images.brands.get(brand.slug),
        name: brand.name
      },
      where: {
        slug: brand.slug
      }
    });
  }

  for (const [slug, logoUrl] of images.brands.entries()) {
    await prisma.brand.updateMany({
      data: {
        logoUrl
      },
      where: {
        slug
      }
    });
  }
}

async function seedCategoryImages(prisma: PrismaClient, images: UploadedImages) {
  for (const [slug, imageUrl] of images.categories.entries()) {
    await prisma.category.updateMany({
      data: {
        description: categoryDescription(slug),
        imageUrl
      },
      where: {
        slug
      }
    });
  }
}

async function seedWarehouses(prisma: PrismaClient, adminUserId: string) {
  const warehouses = [];

  for (const warehouse of WAREHOUSES) {
    const seededWarehouse = await prisma.warehouse.upsert({
      create: {
        ...warehouse,
        status: WarehouseStatus.ACTIVE
      },
      update: {
        ...warehouse,
        deletedAt: null,
        status: WarehouseStatus.ACTIVE
      },
      where: {
        code: warehouse.code
      }
    });

    await prisma.warehouseStaff.upsert({
      create: {
        adminUserId,
        warehouseId: seededWarehouse.id
      },
      update: {
        deletedAt: null
      },
      where: {
        adminUserId_warehouseId: {
          adminUserId,
          warehouseId: seededWarehouse.id
        }
      }
    });

    warehouses.push(seededWarehouse);
  }

  return warehouses;
}

async function seedAdminUser(prisma: PrismaClient) {
  const role = await prisma.role.findUniqueOrThrow({
    where: {
      code: AdminRoleCode.SuperAdmin
    }
  });
  const passwordHash = await bcrypt.hash("ChangeMe-AwsSeed-2026", 10);

  return prisma.adminUser.upsert({
    create: {
      email: "aws.seed.admin@smp.local",
      firstName: "AWS",
      lastName: "Seed Admin",
      mobileNumber: "9000000100",
      passwordHash,
      roleId: role.id,
      status: AdminStatus.ACTIVE
    },
    update: {
      deletedAt: null,
      firstName: "AWS",
      lastName: "Seed Admin",
      mobileNumber: "9000000100",
      passwordHash,
      roleId: role.id,
      status: AdminStatus.ACTIVE
    },
    where: {
      email: "aws.seed.admin@smp.local"
    }
  });
}

async function seedProducts(
  prisma: PrismaClient,
  images: UploadedImages,
  warehouses: Awaited<ReturnType<typeof seedWarehouses>>,
  adminUserId: string
) {
  const seededProducts = [];

  await prisma.stockMovement.deleteMany({
    where: {
      referenceType: DEMO_PREFIX
    }
  });

  for (const [index, item] of PRODUCTS.entries()) {
    const slug = slugify(item.name);
    const brand = await prisma.brand.findUniqueOrThrow({
      where: {
        slug: item.brandSlug
      }
    });
    const category = await prisma.category.findUniqueOrThrow({
      where: {
        slug: item.categorySlug
      }
    });
    const subcategory = item.subcategorySlug
      ? await prisma.category.findUniqueOrThrow({
          where: {
            slug: item.subcategorySlug
          }
        })
      : null;
    const pricing = productPricing(index);

    const seededProduct = await prisma.product.upsert({
      create: {
        basePrice: pricing.basePrice,
        brandId: brand.id,
        categoryId: category.id,
        description: productDescription(item),
        disposable: item.disposable,
        expirySensitive: item.expirySensitive,
        material: item.material,
        medicalSpecialty: item.medicalSpecialty,
        metaDescription: `${item.name} for ${item.medicalSpecialty.toLowerCase()} procurement with verified medical-grade specifications.`,
        metaTitle: `${item.name} | SMP Medical Supplies`,
        mrp: pricing.mrp,
        name: item.name,
        packSize: item.packSize,
        searchTags: searchTags(item),
        sellingPrice: pricing.sellingPrice,
        shortDescription: `${item.packSize} ${item.unit} for ${item.medicalSpecialty.toLowerCase()} teams.`,
        sku: productSku(index),
        slug,
        status: ProductStatus.ACTIVE,
        sterile: item.sterile,
        subcategoryId: subcategory?.id,
        taxRate: pricing.taxRate,
        unit: item.unit
      },
      update: {
        basePrice: pricing.basePrice,
        brandId: brand.id,
        categoryId: category.id,
        deletedAt: null,
        description: productDescription(item),
        disposable: item.disposable,
        expirySensitive: item.expirySensitive,
        material: item.material,
        medicalSpecialty: item.medicalSpecialty,
        metaDescription: `${item.name} for ${item.medicalSpecialty.toLowerCase()} procurement with verified medical-grade specifications.`,
        metaTitle: `${item.name} | SMP Medical Supplies`,
        mrp: pricing.mrp,
        name: item.name,
        packSize: item.packSize,
        searchTags: searchTags(item),
        sellingPrice: pricing.sellingPrice,
        shortDescription: `${item.packSize} ${item.unit} for ${item.medicalSpecialty.toLowerCase()} teams.`,
        status: ProductStatus.ACTIVE,
        sterile: item.sterile,
        subcategoryId: subcategory?.id,
        taxRate: pricing.taxRate,
        unit: item.unit
      },
      where: {
        slug
      }
    });

    await seedProductImages(prisma, seededProduct.id, item.name, images.products.get(slug) ?? []);
    const variants = await seedProductVariants(prisma, seededProduct.id, index, item);
    await seedInventory(prisma, seededProduct.id, variants, warehouses, adminUserId, index);

    seededProducts.push({
      ...seededProduct,
      variants
    });
  }

  return seededProducts;
}

async function seedProductImages(
  prisma: PrismaClient,
  productId: string,
  productName: string,
  urls: string[]
) {
  await prisma.productImage.deleteMany({
    where: {
      productId
    }
  });

  for (const [index, url] of urls.entries()) {
    await prisma.productImage.create({
      data: {
        altText: `${productName} product view ${index + 1}`,
        isPrimary: index === 0,
        productId,
        sortOrder: index + 1,
        url
      }
    });
  }
}

async function seedProductVariants(
  prisma: PrismaClient,
  productId: string,
  productIndex: number,
  item: ProductSeed
) {
  const pricing = productPricing(productIndex);
  const variantInputs = [
    {
      attributes: {
        packSize: item.packSize,
        procurementUse: "Routine replenishment",
        sterility: item.sterile ? "Sterile" : "Non-sterile",
        variant: "Standard"
      },
      mrp: pricing.mrp,
      name: "Standard Pack",
      sellingPrice: pricing.sellingPrice,
      sku: `${productSku(productIndex)}-STD`
    },
    {
      attributes: {
        packSize: bulkPack(item.packSize),
        procurementUse: "Bulk hospital purchase",
        sterility: item.sterile ? "Sterile" : "Non-sterile",
        variant: "Bulk Pack"
      },
      mrp: money(Number(pricing.mrp) * 1.85),
      name: "Bulk Pack",
      sellingPrice: money(Number(pricing.sellingPrice) * 1.78),
      sku: `${productSku(productIndex)}-BULK`
    }
  ];

  const variants = [];

  for (const variant of variantInputs) {
    variants.push(
      await prisma.productVariant.upsert({
        create: {
          ...variant,
          productId,
          status: ProductStatus.ACTIVE
        },
        update: {
          attributes: variant.attributes,
          deletedAt: null,
          mrp: variant.mrp,
          name: variant.name,
          sellingPrice: variant.sellingPrice,
          status: ProductStatus.ACTIVE
        },
        where: {
          sku: variant.sku
        }
      })
    );
  }

  return variants;
}

async function seedInventory(
  prisma: PrismaClient,
  productId: string,
  variants: Awaited<ReturnType<typeof seedProductVariants>>,
  warehouses: Awaited<ReturnType<typeof seedWarehouses>>,
  adminUserId: string,
  productIndex: number
) {
  for (const [variantIndex, variant] of variants.entries()) {
    for (const [warehouseIndex, warehouse] of warehouses.entries()) {
      const availableQuantity =
        18 + ((productIndex + 1) * (variantIndex + 2) * (warehouseIndex + 3)) % 95;
      const reservedQuantity = (productIndex + variantIndex + warehouseIndex) % 8;
      const reorderLevel = 8 + ((productIndex + warehouseIndex) % 10);
      const batchNumber = `${DEMO_PREFIX.toUpperCase()}-${productSku(productIndex)}-${variantIndex + 1}-${warehouse.code}`;

      await prisma.inventoryStock.upsert({
        create: {
          availableQuantity,
          productId,
          reorderLevel,
          reservedQuantity,
          variantId: variant.id,
          warehouseId: warehouse.id
        },
        update: {
          availableQuantity,
          reorderLevel,
          reservedQuantity
        },
        where: {
          productId_variantId_warehouseId: {
            productId,
            variantId: variant.id,
            warehouseId: warehouse.id
          }
        }
      });

      const batch = await prisma.stockBatch.upsert({
        create: {
          batchNumber,
          expiryDate: expiryDate(productIndex),
          mrp: variant.mrp,
          productId,
          purchasePrice: money(Number(variant.sellingPrice) * 0.72),
          quantity: availableQuantity + reservedQuantity,
          sellingPrice: variant.sellingPrice,
          variantId: variant.id,
          warehouseId: warehouse.id
        },
        update: {
          expiryDate: expiryDate(productIndex),
          mrp: variant.mrp,
          purchasePrice: money(Number(variant.sellingPrice) * 0.72),
          quantity: availableQuantity + reservedQuantity,
          sellingPrice: variant.sellingPrice
        },
        where: {
          productId_variantId_warehouseId_batchNumber: {
            batchNumber,
            productId,
            variantId: variant.id,
            warehouseId: warehouse.id
          }
        }
      });

      await prisma.stockMovement.create({
        data: {
          createdById: adminUserId,
          metadata: {
            batchNumber,
            seed: DEMO_PREFIX,
            warehouseCode: warehouse.code
          },
          notes: "Initial AWS fresh catalog stock load",
          productId,
          quantity: availableQuantity + reservedQuantity,
          referenceId: batch.id,
          referenceType: DEMO_PREFIX,
          stockBatchId: batch.id,
          type: StockMovementType.IN,
          variantId: variant.id,
          warehouseId: warehouse.id
        }
      });
    }
  }
}

async function seedCustomers(prisma: PrismaClient) {
  const customers = [];

  for (const [index, customer] of CUSTOMERS.entries()) {
    const [businessName, firstName, lastName, mobileNumber, city, state, pincode] =
      customer;
    const user = await prisma.user.upsert({
      create: {
        businessName,
        email: `aws.customer.${index + 1}@smp.local`,
        firstName,
        gstNumber: `27AWSPS${String(index + 1000).padStart(4, "0")}Z${index % 9}`,
        isActive: true,
        lastName,
        mobileNumber
      },
      update: {
        businessName,
        deletedAt: null,
        email: `aws.customer.${index + 1}@smp.local`,
        firstName,
        gstNumber: `27AWSPS${String(index + 1000).padStart(4, "0")}Z${index % 9}`,
        isActive: true,
        lastName
      },
      where: {
        mobileNumber
      }
    });

    const existingAddress = await prisma.address.findFirst({
      where: {
        userId: user.id,
        type: AddressType.SHIPPING,
        deletedAt: null
      }
    });
    const addressData = {
      city,
      country: "India",
      fullName: `${firstName} ${lastName}`,
      isDefault: true,
      landmark: "Near main hospital road",
      line1: `${businessName}, Procurement Desk`,
      line2: "Medical supplies receiving bay",
      mobileNumber,
      pincode,
      state,
      type: AddressType.SHIPPING,
      userId: user.id
    };

    const address = existingAddress
      ? await prisma.address.update({
          data: addressData,
          where: {
            id: existingAddress.id
          }
        })
      : await prisma.address.create({
          data: addressData
        });

    customers.push({
      address,
      user
    });
  }

  return customers;
}

async function seedCoupons(prisma: PrismaClient) {
  const coupons = [];

  for (const coupon of COUPONS) {
    coupons.push(
      await prisma.coupon.upsert({
        create: {
          ...coupon,
          expiresAt: new Date("2027-12-31T18:29:59.000Z"),
          isActive: true,
          startsAt: new Date("2026-07-01T00:00:00.000Z"),
          usageLimit: 500
        },
        update: {
          ...coupon,
          deletedAt: null,
          expiresAt: new Date("2027-12-31T18:29:59.000Z"),
          isActive: true,
          startsAt: new Date("2026-07-01T00:00:00.000Z"),
          usageLimit: 500
        },
        where: {
          code: coupon.code
        }
      })
    );
  }

  return coupons;
}

async function seedOrders(
  prisma: PrismaClient,
  customers: Awaited<ReturnType<typeof seedCustomers>>,
  products: Awaited<ReturnType<typeof seedProducts>>,
  warehouses: Awaited<ReturnType<typeof seedWarehouses>>,
  coupons: Awaited<ReturnType<typeof seedCoupons>>,
  adminUserId: string
) {
  const existingOrders = await prisma.order.findMany({
    select: {
      id: true
    },
    where: {
      orderNumber: {
        startsWith: "AWS-DEMO-"
      }
    }
  });
  const existingOrderIds = existingOrders.map((order) => order.id);

  if (existingOrderIds.length > 0) {
    await prisma.refund.deleteMany({ where: { orderId: { in: existingOrderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: existingOrderIds } } });
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: existingOrderIds } }
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: existingOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: existingOrderIds } } });
  }

  for (let index = 0; index < 12; index += 1) {
    const customer = customers[index % customers.length];
    const warehouse = warehouses[index % warehouses.length];
    const coupon = index % 3 === 0 ? coupons[index % coupons.length] : null;
    const selectedProducts = [
      products[(index * 3) % products.length],
      products[(index * 3 + 7) % products.length],
      products[(index * 3 + 14) % products.length]
    ];
    const lineItems = selectedProducts.map((item, itemIndex) => {
      const variant = item.variants[itemIndex % item.variants.length];
      const quantity = 1 + ((index + itemIndex) % 4);
      const unitPrice = Number(variant.sellingPrice);
      const taxRate = Number(item.taxRate);
      const taxable = unitPrice * quantity;
      const taxAmount = roundMoney(taxable * (taxRate / 100));

      return {
        item,
        quantity,
        taxAmount,
        taxable,
        taxRate,
        total: roundMoney(taxable + taxAmount),
        unitPrice,
        variant
      };
    });
    const subtotal = roundMoney(
      lineItems.reduce((sum, item) => sum + item.taxable, 0)
    );
    const taxTotal = roundMoney(lineItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const discountTotal = coupon ? Math.min(roundMoney(subtotal * 0.07), 1500) : 0;
    const shippingTotal = subtotal > 10000 ? 0 : 250;
    const grandTotal = roundMoney(subtotal + taxTotal + shippingTotal - discountTotal);
    const status = orderStatus(index);
    const paymentStatus =
      status === OrderStatus.CANCELLED ? PaymentStatus.CANCELLED : PaymentStatus.PAID;

    const order = await prisma.order.create({
      data: {
        billingAddressId: customer.address.id,
        couponId: coupon?.id,
        discountTotal: money(discountTotal),
        grandTotal: money(grandTotal),
        notes: `AWS demo order for ${customer.user.businessName ?? customer.user.firstName}.`,
        orderNumber: `AWS-DEMO-${String(index + 1).padStart(4, "0")}`,
        paymentStatus,
        placedAt: new Date(Date.UTC(2026, 6, 1 + index, 9, 30)),
        shippingAddressId: customer.address.id,
        shippingTotal: money(shippingTotal),
        status,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        userId: customer.user.id,
        warehouseId: warehouse.id
      }
    });

    for (const lineItem of lineItems) {
      const batch = await prisma.stockBatch.findFirst({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          productId: lineItem.item.id,
          quantity: {
            gt: 0
          },
          variantId: lineItem.variant.id,
          warehouseId: warehouse.id
        }
      });

      await prisma.orderItem.create({
        data: {
          name: lineItem.item.name,
          orderId: order.id,
          productId: lineItem.item.id,
          quantity: lineItem.quantity,
          sku: lineItem.variant.sku,
          stockBatchId: batch?.id,
          taxAmount: money(lineItem.taxAmount),
          taxRate: money(lineItem.taxRate),
          total: money(lineItem.total),
          unitPrice: money(lineItem.unitPrice),
          variantId: lineItem.variant.id,
          warehouseId: warehouse.id
        }
      });
    }

    await prisma.payment.create({
      data: {
        amount: money(grandTotal),
        method: index % 4 === 0 ? PaymentMethod.COD : PaymentMethod.ONLINE,
        orderId: order.id,
        paidAt: paymentStatus === PaymentStatus.PAID ? order.placedAt : null,
        provider: index % 4 === 0 ? "cod" : "razorpay",
        providerAmountPaise: Math.round(grandTotal * 100),
        providerOrderId: `order_aws_demo_${String(index + 1).padStart(4, "0")}`,
        providerPaymentId:
          paymentStatus === PaymentStatus.PAID
            ? `pay_aws_demo_${String(index + 1).padStart(4, "0")}`
            : null,
        status: paymentStatus
      }
    });

    await prisma.orderStatusHistory.createMany({
      data: [
        {
          changedById: adminUserId,
          note: "Order created from AWS fresh catalog seed.",
          orderId: order.id,
          status: OrderStatus.CREATED
        },
        {
          changedById: adminUserId,
          note: `Order moved to ${status}.`,
          orderId: order.id,
          status
        }
      ]
    });
  }
}

function orderStatus(index: number) {
  const statuses = [
    OrderStatus.CREATED,
    OrderStatus.CONFIRMED,
    OrderStatus.PACKED,
    OrderStatus.ASSIGNED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED
  ];

  return statuses[index % statuses.length];
}

function productPricing(index: number) {
  const taxRate = index % 5 === 0 ? 12 : 18;
  const mrp = 450 + index * 235 + (index % 4) * 99;
  const sellingPrice = roundMoney(mrp * (0.78 + (index % 6) * 0.015));
  const basePrice = roundMoney(sellingPrice / (1 + taxRate / 100));

  return {
    basePrice: money(basePrice),
    mrp: money(mrp),
    sellingPrice: money(sellingPrice),
    taxRate: money(taxRate)
  };
}

function productSku(index: number) {
  return `AWS-SMP-${String(index + 1).padStart(4, "0")}`;
}

function productDescription(item: ProductSeed) {
  const sterile = item.sterile
    ? "sterile packed for controlled clinical use"
    : "supplied for standard clinical handling";
  const disposable = item.disposable
    ? "single-use workflow"
    : "reusable or durable workflow";
  const expiry = item.expirySensitive
    ? "Expiry tracking is recommended for warehouse rotation."
    : "No routine expiry rotation is required beyond standard quality checks.";

  return `${item.name} is a ${item.material.toLowerCase()} product for ${item.medicalSpecialty.toLowerCase()} teams. It is ${sterile}, supports ${disposable}, and ships as ${item.packSize}. ${expiry} Suitable for hospitals, clinics and bulk procurement teams that need predictable supply, clear SKU tracking and warehouse-level stock visibility.`;
}

function categoryDescription(slug: string) {
  const label = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  return `${label} products curated for hospital procurement, clinical operations and recurring medical supply replenishment.`;
}

function searchTags(item: ProductSeed) {
  return [
    item.name.toLowerCase(),
    item.brandSlug,
    item.categorySlug,
    item.subcategorySlug,
    item.medicalSpecialty.toLowerCase(),
    item.material.toLowerCase(),
    item.sterile ? "sterile" : "non sterile",
    item.disposable ? "disposable" : "durable"
  ].filter(Boolean) as string[];
}

function bulkPack(packSize: string) {
  if (/box/i.test(packSize)) {
    return `${packSize} x 4`;
  }

  if (/pack/i.test(packSize)) {
    return `${packSize} x 5`;
  }

  return `Bulk ${packSize}`;
}

function expiryDate(index: number) {
  if (index % 7 === 0) {
    return null;
  }

  return new Date(Date.UTC(2027 + (index % 3), index % 12, 15));
}

function money(value: number | string) {
  return Number(value).toFixed(2);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createSeedImage(input: {
  kind: "brand" | "category" | "product";
  label: string;
  seed: string;
  variant?: number;
}) {
  const hash = createHash("sha256").update(input.seed).digest();
  const base = [hash[0] ?? 60, hash[1] ?? 110, hash[2] ?? 160] as const;
  const accent = [hash[3] ?? 190, hash[4] ?? 120, hash[5] ?? 70] as const;
  const data = Buffer.alloc(IMAGE_WIDTH * IMAGE_HEIGHT * 4);

  for (let y = 0; y < IMAGE_HEIGHT; y += 1) {
    for (let x = 0; x < IMAGE_WIDTH; x += 1) {
      const offset = (y * IMAGE_WIDTH + x) * 4;
      const gradient = y / IMAGE_HEIGHT;
      data[offset] = clamp(base[0] * (1 - gradient) + 245 * gradient);
      data[offset + 1] = clamp(base[1] * (1 - gradient) + 248 * gradient);
      data[offset + 2] = clamp(base[2] * (1 - gradient) + 250 * gradient);
      data[offset + 3] = 255;
    }
  }

  drawRect(data, 72, 72, IMAGE_WIDTH - 144, IMAGE_HEIGHT - 144, [255, 255, 255, 208]);
  drawRect(data, 118, 120, IMAGE_WIDTH - 236, 48, [accent[0], accent[1], accent[2], 255]);
  drawRect(data, 118, 204, 420, 420, [235, 241, 245, 255]);
  drawRect(data, 602, 214, 420, 42, [base[0], base[1], base[2], 255]);
  drawRect(data, 602, 294, 340, 30, [120, 132, 146, 255]);
  drawRect(data, 602, 352, 460, 30, [148, 163, 184, 255]);
  drawRect(data, 602, 412, 390, 30, [148, 163, 184, 255]);
  drawRect(data, 602, 510, 260, 76, [accent[0], accent[1], accent[2], 255]);

  const centerX = input.kind === "brand" ? 330 : 328;
  const centerY = input.kind === "product" ? 405 : 380;
  drawCircle(data, centerX, centerY, 128 + (input.variant ?? 0) * 16, [
    base[0],
    base[1],
    base[2],
    255
  ]);
  drawCircle(data, centerX + 55, centerY - 50, 58, [
    accent[0],
    accent[1],
    accent[2],
    230
  ]);

  for (let i = 0; i < 10; i += 1) {
    const stripeY = 692 + i * 16;
    drawRect(data, 118 + i * 26, stripeY, 860 - i * 34, 6, [
      210 - i * 4,
      218 - i * 3,
      226 - i * 2,
      255
    ]);
  }

  const labelHash = createHash("sha1").update(input.label).digest();
  for (let i = 0; i < 8; i += 1) {
    const barWidth = 36 + (labelHash[i] ?? 0) % 130;
    drawRect(data, 602, 630 + i * 18, barWidth, 8, [
      base[0],
      base[1],
      base[2],
      180
    ]);
  }

  return encodePng(IMAGE_WIDTH, IMAGE_HEIGHT, data);
}

function drawRect(
  data: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly number[]
) {
  for (let yy = Math.max(0, y); yy < Math.min(IMAGE_HEIGHT, y + height); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(IMAGE_WIDTH, x + width); xx += 1) {
      blendPixel(data, xx, yy, color);
    }
  }
}

function drawCircle(
  data: Buffer,
  centerX: number,
  centerY: number,
  radius: number,
  color: readonly number[]
) {
  const radiusSquared = radius * radius;

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;

      if (dx * dx + dy * dy <= radiusSquared) {
        blendPixel(data, x, y, color);
      }
    }
  }
}

function blendPixel(data: Buffer, x: number, y: number, color: readonly number[]) {
  if (x < 0 || y < 0 || x >= IMAGE_WIDTH || y >= IMAGE_HEIGHT) {
    return;
  }

  const offset = (y * IMAGE_WIDTH + x) * 4;
  const alpha = (color[3] ?? 255) / 255;

  data[offset] = clamp((color[0] ?? 0) * alpha + data[offset] * (1 - alpha));
  data[offset + 1] = clamp((color[1] ?? 0) * alpha + data[offset + 1] * (1 - alpha));
  data[offset + 2] = clamp((color[2] ?? 0) * alpha + data[offset + 2] * (1 - alpha));
  data[offset + 3] = 255;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function encodePng(width: number, height: number, rgba: Buffer) {
  const scanlineLength = width * 4 + 1;
  const raw = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * scanlineLength] = 0;
    rgba.copy(
      raw,
      y * scanlineLength + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function ihdr(width: number, height: number) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

async function main() {
  loadEnvironment();

  const prisma = createPrismaClient();
  const s3 = createS3Client();

  try {
    console.log("Checking AWS RDS connection.");
    await prisma.$queryRaw`SELECT 1`;

    console.log("Seeding base access control and fixed catalog data.");
    await seedAccessControl(prisma);
    await seedCatalogCategories(prisma);
    await seedCatalogBrands(prisma);

    console.log("Uploading generated catalog images to S3.");
    const images = await uploadSeedImages(s3);

    console.log("Seeding AWS RDS catalog, warehouse, inventory and order data.");
    await seedBrands(prisma, images);
    await seedCategoryImages(prisma, images);

    const admin = await seedAdminUser(prisma);
    const warehouses = await seedWarehouses(prisma, admin.id);
    const products = await seedProducts(prisma, images, warehouses, admin.id);
    const customers = await seedCustomers(prisma);
    const coupons = await seedCoupons(prisma);
    await seedOrders(prisma, customers, products, warehouses, coupons, admin.id);

    const counts = {
      brands: await prisma.brand.count({ where: { deletedAt: null } }),
      categories: await prisma.category.count({ where: { deletedAt: null } }),
      customers: await prisma.user.count({ where: { deletedAt: null } }),
      inventoryStocks: await prisma.inventoryStock.count(),
      orders: await prisma.order.count(),
      productImages: await prisma.productImage.count(),
      productVariants: await prisma.productVariant.count({ where: { deletedAt: null } }),
      products: await prisma.product.count({ where: { deletedAt: null } }),
      stockBatches: await prisma.stockBatch.count(),
      warehouses: await prisma.warehouse.count({ where: { deletedAt: null } })
    };

    console.table(counts);
    console.log(`Uploaded ${PRODUCTS.length * PRODUCT_IMAGE_COUNT} product images plus brand and category images to ${publicBaseUrl()}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
