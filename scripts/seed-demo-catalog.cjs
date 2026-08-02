const fs = require("node:fs");
const path = require("node:path");

const API_BASE_DEFAULT = "http://localhost:4000/api/v1";
const GENERATED_IMAGE_DIR =
  "C:/Users/Ritik Singh/.codex/generated_images/019ebff5-f4d4-75d0-837c-e1913b95270a";
const ASSET_DIR = path.resolve("storage/uploads/demo-catalog-assets");
const PRODUCT_TILE_WIDTH = 1200;
const PRODUCT_TILE_HEIGHT = 640;
const CATEGORY_TILE_WIDTH = 1200;
const CATEGORY_TILE_HEIGHT = 640;
const ASSET_VERSION = "unique-v3";
const DEFAULT_PRODUCT_TARGET_COUNT = 200;
const PRODUCT_TARGET_COUNT = Number(
  process.env.DEMO_SEED_PRODUCT_COUNT ?? DEFAULT_PRODUCT_TARGET_COUNT
);
const REQUEST_INTERVAL_MS = Number(process.env.DEMO_SEED_REQUEST_INTERVAL_MS ?? 850);
const REFRESH_UPLOADED_IMAGES = process.env.DEMO_SEED_REFRESH_IMAGES === "1";
const REFRESH_BRAND_IMAGES =
  REFRESH_UPLOADED_IMAGES || process.env.DEMO_SEED_REFRESH_BRAND_IMAGES === "1";
const REFRESH_CATEGORY_IMAGES =
  REFRESH_UPLOADED_IMAGES || process.env.DEMO_SEED_REFRESH_CATEGORY_IMAGES === "1";
const REFRESH_PRODUCT_IMAGES =
  REFRESH_UPLOADED_IMAGES || process.env.DEMO_SEED_REFRESH_PRODUCT_IMAGES === "1";
const SKIP_BRAND_IMAGES = process.env.DEMO_SEED_SKIP_BRAND_IMAGES === "1";
const SKIP_CATEGORY_IMAGES = process.env.DEMO_SEED_SKIP_CATEGORY_IMAGES === "1";
const PRUNE_STALE_DEMO_PRODUCTS = process.env.DEMO_SEED_PRUNE === "1";

const PRODUCT_GALLERY_VIEWS = [
  {
    alt: "main product view",
    fileSuffix: "main",
    key: "main",
    label: "Product",
    productBox: { height: 500, left: 220, top: 80, width: 760 },
    sortOrder: 0,
    subtitle: "Front view"
  },
  {
    alt: "specification view",
    fileSuffix: "spec",
    key: "specification",
    label: "Specs",
    productBox: { height: 380, left: 96, top: 130, width: 560 },
    sortOrder: 1,
    subtitle: "Variant details"
  },
  {
    alt: "package and scale view",
    fileSuffix: "pack",
    key: "package",
    label: "Pack",
    productBox: { height: 360, left: 560, top: 140, width: 520 },
    sortOrder: 2,
    subtitle: "Supply format"
  }
];

const PRODUCT_IMAGE_PALETTES = [
  { accent: "#0F766E", bgEnd: "#E8F7F4", bgStart: "#F9FEFC", ink: "#123D3A", panel: "#FFFFFF" },
  { accent: "#2563EB", bgEnd: "#EAF0FF", bgStart: "#FBFDFF", ink: "#162C5B", panel: "#FFFFFF" },
  { accent: "#B45309", bgEnd: "#FFF2D9", bgStart: "#FFFCF6", ink: "#56330E", panel: "#FFFFFF" },
  { accent: "#7C3AED", bgEnd: "#F1ECFF", bgStart: "#FCFAFF", ink: "#3C236F", panel: "#FFFFFF" },
  { accent: "#BE123C", bgEnd: "#FFEAF0", bgStart: "#FFFBFC", ink: "#5B1729", panel: "#FFFFFF" },
  { accent: "#047857", bgEnd: "#E7F8EF", bgStart: "#FAFFFC", ink: "#143D2A", panel: "#FFFFFF" }
];

const SHARP_CANDIDATES = [
  "C:/Users/Ritik Singh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp",
  path.resolve("node_modules/.pnpm/sharp@0.34.5/node_modules/sharp"),
  "sharp"
];

function loadSharp() {
  for (const candidate of SHARP_CANDIDATES) {
    try {
      return require(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Unable to load sharp. Install dependencies or run with the bundled Codex node runtime.");
}

const sharp = loadSharp();

const SOURCE_SHEETS = [
  {
    cols: 8,
    file: "ig_07be405d09759e12016a2d13c62b6c8191a0d0f44a2561a54f.png",
    label: "surgical-instruments"
  },
  {
    cols: 7,
    file: "ig_07be405d09759e12016a2d14193bac8191b4c6be17902211a9.png",
    label: "consumables"
  },
  {
    cols: 7,
    file: "ig_07be405d09759e12016a2d1459459c8191b94d57d4f8e1184d.png",
    label: "diagnostics-critical-care"
  },
  {
    cols: 7,
    file: "ig_07be405d09759e12016a2d148e84c08191ac62edb7c96e34ef.png",
    label: "dental-ophthalmology-ortho"
  },
  {
    cols: 7,
    file: "ig_07be405d09759e12016a2d14c66530819186de1bcac43a4184.png",
    label: "hospital-specialty"
  }
];

const BRAND_DESCRIPTIONS = {
  abbott: "Diagnostics and cold-chain medical supplies for reliable clinical workflows.",
  contec: "Connected monitoring and point-of-care equipment for hospitals and clinics.",
  gc: "Dental restorative and impression materials for chairside procedures.",
  healthium: "Surgical instruments and procedure-ready sterile consumables.",
  "j-mitra": "Diagnostic kits and lab-ready medical consumables for fast screening.",
  "mb-plus": "Hospital essentials, mobility support, and general medical supplies.",
  orikam: "Dental devices and operatory accessories for daily practice.",
  volk: "Ophthalmic diagnostic lenses and clinical eye-care equipment."
};

const WAREHOUSES = [
  {
    address: "Unit 4, MedTech Park, Andheri East",
    city: "Mumbai",
    code: "DEMO-MUM-01",
    contactNumber: "9876543210",
    contactPerson: "Aarav Sharma",
    latitude: 19.1155,
    longitude: 72.8727,
    name: "Demo Mumbai Medical Hub",
    pincode: "400093",
    state: "Maharashtra"
  },
  {
    address: "Plot 18, Okhla Industrial Estate Phase II",
    city: "New Delhi",
    code: "DEMO-DEL-01",
    contactNumber: "9812345678",
    contactPerson: "Nisha Mehra",
    latitude: 28.5355,
    longitude: 77.2746,
    name: "Demo Delhi Clinical Depot",
    pincode: "110020",
    state: "Delhi"
  },
  {
    address: "Warehouse 7, Peenya Industrial Area",
    city: "Bengaluru",
    code: "DEMO-BLR-01",
    contactNumber: "9845012345",
    contactPerson: "Kiran Rao",
    latitude: 13.0358,
    longitude: 77.5006,
    name: "Demo Bengaluru Surgical Supply",
    pincode: "560058",
    state: "Karnataka"
  },
  {
    address: "Shed 12, Genome Valley Logistics Block",
    city: "Hyderabad",
    code: "DEMO-HYD-01",
    contactNumber: "9700123456",
    contactPerson: "Farah Khan",
    latitude: 17.5435,
    longitude: 78.5718,
    name: "Demo Hyderabad Life Sciences Store",
    pincode: "500078",
    state: "Telangana"
  },
  {
    address: "Block B, Taratala Medical Logistics Park",
    city: "Kolkata",
    code: "DEMO-KOL-01",
    contactNumber: "9830012345",
    contactPerson: "Rohan Sen",
    latitude: 22.5145,
    longitude: 88.2928,
    name: "Demo Kolkata Eastern Warehouse",
    pincode: "700088",
    state: "West Bengal"
  }
];

const PRODUCTS = [
  product({
    brand: "healthium",
    category: "consumables",
    disposable: false,
    image: [0, 0],
    material: "German stainless steel",
    medicalSpecialty: "General Surgery",
    mrp: 1450,
    name: "Rochester Pean Artery Forceps",
    packSize: "1 reusable instrument",
    sterile: true,
    subcategory: "medical-instruments",
    unit: "piece",
    useCase: "clamping larger vessels and tissue pedicles during open procedures",
    variants: sizeVariants(["6 inch", "8 inch"], "Length")
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: false,
    image: [0, 1],
    material: "Satin-finish stainless steel",
    medicalSpecialty: "Operating Room",
    mrp: 1180,
    name: "Mayo Operating Scissors",
    packSize: "1 reusable scissor",
    sterile: true,
    subcategory: "medical-instruments",
    unit: "piece",
    useCase: "cutting fascia, sutures, drapes, and dense operating-room material",
    variants: namedVariants([
      ["Straight", { pattern: "Straight", length: "6 inch" }, 1],
      ["Curved", { pattern: "Curved", length: "6 inch" }, 1.05]
    ])
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: false,
    image: [0, 2],
    material: "Fine-tip stainless steel",
    medicalSpecialty: "Soft Tissue Surgery",
    mrp: 1320,
    name: "Metzenbaum Dissecting Scissors",
    packSize: "1 reusable scissor",
    sterile: true,
    subcategory: "medical-instruments",
    unit: "piece",
    useCase: "controlled dissection of delicate soft tissue planes",
    variants: sizeVariants(["5.5 inch", "7 inch"], "Length")
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: false,
    image: [0, 3],
    material: "Serrated stainless steel",
    medicalSpecialty: "General Surgery",
    mrp: 1240,
    name: "Kelly Hemostatic Forceps",
    packSize: "1 reusable forceps",
    sterile: true,
    subcategory: "medical-instruments",
    unit: "piece",
    useCase: "temporary hemostasis and secure tissue handling",
    variants: namedVariants([
      ["Straight", { pattern: "Straight", length: "5.5 inch" }, 1],
      ["Curved", { pattern: "Curved", length: "5.5 inch" }, 1.04]
    ])
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: false,
    image: [0, 4],
    material: "Reusable handle with sterile carbon steel blades",
    medicalSpecialty: "Operating Room",
    mrp: 690,
    name: "Reusable Scalpel Handle Blade Set",
    packSize: "1 handle with 10 blades",
    sterile: true,
    subcategory: "surgical-consumables",
    unit: "set",
    useCase: "precise skin and soft tissue incision during minor and major procedures",
    variants: namedVariants([
      ["Handle No. 3", { handle: "No. 3", bladeCompatibility: "10-15" }, 1],
      ["Handle No. 4", { handle: "No. 4", bladeCompatibility: "20-24" }, 1.08]
    ])
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: false,
    image: [0, 5],
    material: "Serrated stainless steel",
    medicalSpecialty: "General Surgery",
    mrp: 1120,
    name: "Mosquito Hemostat Forceps",
    packSize: "1 reusable forceps",
    sterile: true,
    subcategory: "medical-instruments",
    unit: "piece",
    useCase: "fine-vessel clamping and controlled handling in confined fields",
    variants: namedVariants([
      ["Straight", { pattern: "Straight", length: "5 inch" }, 1],
      ["Curved", { pattern: "Curved", length: "5 inch" }, 1.05]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "equipment",
    disposable: false,
    image: [0, 6],
    material: "Polished stainless steel",
    medicalSpecialty: "Surgery",
    mrp: 2380,
    name: "Deaver Retractor Set",
    packSize: "Set of 3 sizes",
    sterile: true,
    subcategory: "surgery",
    unit: "set",
    useCase: "deep tissue retraction and wound exposure in abdominal surgery",
    variants: namedVariants([
      ["Small Set", { sizes: "Small/Medium/Large", finish: "Mirror" }, 1],
      ["Large Set", { sizes: "Medium/Large/XL", finish: "Satin" }, 1.18]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "equipment",
    disposable: false,
    image: [0, 7],
    material: "Seamless stainless steel",
    medicalSpecialty: "Hospital Utility",
    mrp: 860,
    name: "Stainless Kidney Tray",
    packSize: "1 tray",
    sterile: false,
    subcategory: "surgery",
    unit: "piece",
    useCase: "holding dressings, swabs, and instruments during ward or theatre care",
    variants: sizeVariants(["8 inch", "10 inch", "12 inch"], "Tray size")
  }),
  product({
    brand: "mb-plus",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 0],
    material: "Latex-free nitrile",
    medicalSpecialty: "Infection Control",
    mrp: 540,
    name: "Sterile Examination Glove Dispenser",
    packSize: "Box of 100 gloves",
    sterile: true,
    subcategory: "hygiene-control",
    unit: "box",
    useCase: "barrier protection for examination rooms, minor procedures, and triage",
    variants: sizeVariants(["Small", "Medium", "Large"], "Size")
  }),
  product({
    brand: "mb-plus",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 1],
    material: "Melt-blown non-woven fabric",
    medicalSpecialty: "Infection Control",
    mrp: 360,
    name: "3-Ply Surgical Face Mask Pack",
    packSize: "Pack of 50 masks",
    sterile: false,
    subcategory: "hygiene-control",
    unit: "pack",
    useCase: "daily respiratory barrier protection for staff and patients",
    variants: namedVariants([
      ["Earloop", { style: "Earloop", ply: 3 }, 1],
      ["Tie-On", { style: "Tie-On", ply: 3 }, 1.08]
    ])
  }),
  product({
    brand: "j-mitra",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 2],
    material: "Medical-grade polypropylene",
    medicalSpecialty: "Nursing",
    mrp: 680,
    name: "Luer Lock Syringe Set 5 ml",
    packSize: "Box of 100 syringes",
    sterile: true,
    subcategory: "medical-consumables",
    unit: "box",
    useCase: "accurate medication preparation and sample handling",
    variants: sizeVariants(["2 ml", "5 ml", "10 ml"], "Capacity")
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 3],
    material: "FEP catheter with stainless introducer needle",
    medicalSpecialty: "IV Therapy",
    mrp: 820,
    name: "Multi Gauge IV Cannula Starter Set",
    packSize: "Box of 50 cannulas",
    sterile: true,
    subcategory: "catheters",
    unit: "box",
    useCase: "peripheral venous access across adult and pediatric settings",
    variants: namedVariants([
      ["18G Green", { gauge: "18G", color: "Green" }, 1],
      ["20G Pink", { gauge: "20G", color: "Pink" }, 1],
      ["22G Blue", { gauge: "22G", color: "Blue" }, 1]
    ])
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 4],
    material: "Sterile cotton gauze",
    medicalSpecialty: "Wound Care",
    mrp: 420,
    name: "Sterile Gauze Roll",
    packSize: "Pack of 12 rolls",
    sterile: true,
    subcategory: "bandages-wound",
    unit: "pack",
    useCase: "absorbent dressing, wound packing, and procedure-room preparation",
    variants: sizeVariants(["5 cm x 4 m", "7.5 cm x 4 m", "10 cm x 4 m"], "Roll size")
  }),
  product({
    brand: "healthium",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 5],
    material: "Nylon monofilament",
    medicalSpecialty: "Wound Closure",
    mrp: 980,
    name: "Monofilament Suture Pack",
    packSize: "Box of 12 sterile sutures",
    sterile: true,
    subcategory: "surgical-consumables",
    unit: "box",
    useCase: "skin approximation and low-reactivity wound closure",
    variants: namedVariants([
      ["2-0 Reverse Cutting", { size: "2-0", needle: "Reverse Cutting" }, 1],
      ["3-0 Reverse Cutting", { size: "3-0", needle: "Reverse Cutting" }, 1],
      ["4-0 Reverse Cutting", { size: "4-0", needle: "Reverse Cutting" }, 1.04]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "consumables",
    disposable: true,
    expirySensitive: true,
    image: [1, 6],
    material: "SMS non-woven fabric",
    medicalSpecialty: "Operating Room",
    mrp: 1120,
    name: "Disposable Surgical Drape",
    packSize: "Pack of 10 drapes",
    sterile: true,
    subcategory: "gown-drapes",
    unit: "pack",
    useCase: "sterile field creation for minor and major procedures",
    variants: sizeVariants(["Small", "Medium", "Large"], "Drape size")
  }),
  product({
    brand: "contec",
    category: "diagnostics",
    disposable: false,
    image: [2, 0],
    material: "ABS housing with nylon cuff",
    medicalSpecialty: "Vitals Monitoring",
    mrp: 2450,
    name: "Digital Blood Pressure Monitor",
    packSize: "1 monitor with cuff",
    sterile: false,
    subcategory: "instruments",
    unit: "unit",
    useCase: "routine systolic and diastolic pressure measurement in OPD and wards",
    variants: namedVariants([
      ["Adult Cuff", { cuff: "Adult", memory: "120 readings" }, 1],
      ["Large Cuff", { cuff: "Large adult", memory: "120 readings" }, 1.08]
    ])
  }),
  product({
    brand: "contec",
    category: "diagnostics",
    disposable: false,
    image: [2, 1],
    material: "ABS body with OLED display",
    medicalSpecialty: "Vitals Monitoring",
    mrp: 1680,
    name: "Fingertip Pulse Oximeter",
    packSize: "1 oximeter",
    sterile: false,
    subcategory: "point-of-care-testing-poct",
    unit: "unit",
    useCase: "spot SpO2 and pulse-rate screening at bedside or triage",
    variants: namedVariants([
      ["Standard OLED", { display: "OLED", orientation: "Auto rotate" }, 1],
      ["Bluetooth OLED", { display: "OLED", connectivity: "Bluetooth" }, 1.22]
    ])
  }),
  product({
    brand: "contec",
    category: "diagnostics",
    disposable: false,
    image: [2, 2],
    material: "Water-resistant clinical probe",
    medicalSpecialty: "Vitals Monitoring",
    mrp: 420,
    name: "Digital Clinical Thermometer",
    packSize: "1 thermometer",
    sterile: false,
    subcategory: "instruments",
    unit: "piece",
    useCase: "oral, axillary, and rectal temperature checks with quick recall",
    variants: namedVariants([
      ["Flexible Tip", { tip: "Flexible", readingTime: "30 seconds" }, 1],
      ["Rigid Tip", { tip: "Rigid", readingTime: "45 seconds" }, 0.92]
    ])
  }),
  product({
    brand: "contec",
    category: "equipment",
    disposable: false,
    image: [2, 3],
    material: "Medical-grade compressor with PVC tubing",
    medicalSpecialty: "Respiratory Care",
    mrp: 2850,
    name: "Compressor Nebulizer Kit",
    packSize: "1 nebulizer with adult and child masks",
    sterile: false,
    subcategory: "critical-care",
    unit: "unit",
    useCase: "aerosol medication delivery for OPD, home care, and emergency rooms",
    variants: namedVariants([
      ["Standard Flow", { flowRate: "6 LPM", maskSet: "Adult + Child" }, 1],
      ["High Flow", { flowRate: "8 LPM", maskSet: "Adult + Child" }, 1.15]
    ])
  }),
  product({
    brand: "contec",
    category: "diagnostics",
    disposable: false,
    image: [2, 4],
    material: "Stainless chest piece with latex-free tubing",
    medicalSpecialty: "Clinical Examination",
    mrp: 1320,
    name: "Dual Head Stethoscope",
    packSize: "1 stethoscope",
    sterile: false,
    subcategory: "instruments",
    unit: "piece",
    useCase: "cardiac, pulmonary, and general auscultation in clinics and wards",
    variants: namedVariants([
      ["Black Tube", { tubeColor: "Black", head: "Dual" }, 1],
      ["Navy Tube", { tubeColor: "Navy", head: "Dual" }, 1]
    ])
  }),
  product({
    brand: "abbott",
    category: "diagnostics",
    disposable: false,
    expirySensitive: true,
    image: [2, 5],
    material: "Meter with enzyme test strips",
    medicalSpecialty: "Diabetes Care",
    mrp: 1960,
    name: "Glucose Monitoring Kit",
    packSize: "Meter with 25 strips and lancets",
    sterile: false,
    subcategory: "point-of-care-testing-poct",
    unit: "kit",
    useCase: "capillary blood glucose screening for OPD and home-monitoring programs",
    variants: namedVariants([
      ["Starter Kit", { strips: 25, lancets: 25 }, 1],
      ["Clinic Kit", { strips: 50, lancets: 50 }, 1.34]
    ])
  }),
  product({
    brand: "contec",
    category: "cardiology",
    disposable: false,
    image: [2, 6],
    material: "Portable monitor with rechargeable battery",
    medicalSpecialty: "Cardiology",
    mrp: 14500,
    name: "Portable ECG Monitor",
    packSize: "1 monitor with leads",
    sterile: false,
    subcategory: "accessories",
    unit: "unit",
    useCase: "rapid rhythm checks and basic ECG review in wards or outreach camps",
    variants: namedVariants([
      ["3 Lead", { leadMode: "3 lead", display: "Color" }, 1],
      ["6 Lead", { leadMode: "6 lead", display: "Color" }, 1.32]
    ])
  }),
  product({
    brand: "orikam",
    category: "dental",
    disposable: false,
    image: [3, 0],
    material: "Stainless steel handles and mirrors",
    medicalSpecialty: "Dental Examination",
    mrp: 860,
    name: "Dental Examination Mirror Probe Set",
    packSize: "Set of 3 instruments",
    sterile: true,
    subcategory: "small-equipment",
    unit: "set",
    useCase: "routine oral examination, plaque checks, and cavity exploration",
    variants: namedVariants([
      ["Standard Handle", { handle: "Standard", mirror: "No. 4" }, 1],
      ["Ergo Handle", { handle: "Ergonomic", mirror: "No. 5" }, 1.12]
    ])
  }),
  product({
    brand: "orikam",
    category: "dental",
    disposable: false,
    image: [3, 1],
    material: "LED curing body with autoclavable tips",
    medicalSpecialty: "Restorative Dentistry",
    mrp: 5200,
    name: "LED Dental Curing Light Kit",
    packSize: "1 curing light with 8 tips",
    sterile: false,
    subcategory: "small-equipment",
    unit: "kit",
    useCase: "polymerizing composite restorations and bonding materials chairside",
    variants: namedVariants([
      ["Standard Output", { output: "1200 mW/cm2", modes: 3 }, 1],
      ["High Output", { output: "1800 mW/cm2", modes: 5 }, 1.28]
    ])
  }),
  product({
    brand: "gc",
    category: "dental",
    disposable: true,
    expirySensitive: true,
    image: [3, 2],
    material: "VPS impression material",
    medicalSpecialty: "Prosthodontics",
    mrp: 3480,
    name: "VPS Impression Cartridge Kit",
    packSize: "2 cartridges with 10 mixing tips",
    sterile: false,
    subcategory: "impression-materials",
    unit: "kit",
    useCase: "accurate crown, bridge, implant, and diagnostic impressions",
    variants: namedVariants([
      ["Light Body", { viscosity: "Light body", set: "Regular" }, 1],
      ["Heavy Body", { viscosity: "Heavy body", set: "Regular" }, 1.08]
    ])
  }),
  product({
    brand: "volk",
    category: "ophthalmology",
    disposable: false,
    image: [3, 3],
    material: "Optical glass lenses in hard case",
    medicalSpecialty: "Ophthalmology",
    mrp: 18500,
    name: "Ophthalmic Trial Lens Set",
    packSize: "Full trial lens case",
    sterile: false,
    subcategory: "diagnostic-lenses",
    unit: "set",
    useCase: "refraction assessment and diagnostic lens selection in eye clinics",
    variants: namedVariants([
      ["158 Piece", { lensCount: 158, case: "Hard" }, 1],
      ["232 Piece", { lensCount: 232, case: "Hard" }, 1.35]
    ])
  }),
  product({
    brand: "volk",
    category: "ophthalmology",
    disposable: false,
    image: [3, 4],
    material: "Lightweight alloy frame",
    medicalSpecialty: "Ophthalmology",
    mrp: 7200,
    name: "Adjustable Trial Frame",
    packSize: "1 adult frame",
    sterile: false,
    subcategory: "diagnostic-equipment",
    unit: "piece",
    useCase: "holding trial lenses during subjective refraction testing",
    variants: namedVariants([
      ["Adult", { patientType: "Adult", pdRange: "48-80 mm" }, 1],
      ["Pediatric", { patientType: "Pediatric", pdRange: "40-58 mm" }, 0.92]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "physiotherapy",
    disposable: false,
    image: [3, 5],
    material: "Cotton crepe with clips",
    medicalSpecialty: "Physiotherapy",
    mrp: 540,
    name: "Crepe Bandage Roll Set",
    packSize: "Pack of 6 rolls",
    sterile: false,
    subcategory: "fracture-aids",
    unit: "pack",
    useCase: "supportive compression for sprains, strains, and post-injury care",
    variants: sizeVariants(["6 cm", "8 cm", "10 cm"], "Width")
  }),
  product({
    brand: "mb-plus",
    category: "physiotherapy",
    disposable: false,
    image: [3, 6],
    material: "Molded foam and plastic support shell",
    medicalSpecialty: "Physiotherapy",
    mrp: 1650,
    name: "Adjustable Cervical Collar",
    packSize: "1 collar",
    sterile: false,
    subcategory: "cervical-aids",
    unit: "piece",
    useCase: "comfortable neck immobilization and post-trauma cervical support",
    variants: sizeVariants(["Small", "Medium", "Large"], "Size")
  }),
  product({
    brand: "mb-plus",
    category: "equipment",
    disposable: false,
    image: [4, 0],
    material: "Powder-coated steel frame",
    medicalSpecialty: "Hospital Furniture",
    mrp: 62000,
    name: "Electric ICU Bed",
    packSize: "1 five-function bed",
    sterile: false,
    subcategory: "hospital-furniture",
    unit: "unit",
    useCase: "positioning critical-care patients with electric height and backrest control",
    variants: namedVariants([
      ["Three Function", { functions: 3, sideRails: "ABS" }, 1],
      ["Five Function", { functions: 5, sideRails: "ABS" }, 1.32]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "equipment",
    disposable: false,
    image: [4, 1],
    material: "LED head with wheeled stand",
    medicalSpecialty: "Surgery",
    mrp: 18800,
    name: "Mobile LED Examination Light",
    packSize: "1 mobile light",
    sterile: false,
    subcategory: "surgery",
    unit: "unit",
    useCase: "focused illumination for examination rooms and minor procedures",
    variants: namedVariants([
      ["Single Dome", { dome: "Single", intensity: "60,000 lux" }, 1],
      ["Dual Intensity", { dome: "Single", intensity: "90,000 lux" }, 1.21]
    ])
  }),
  product({
    brand: "contec",
    category: "equipment",
    disposable: false,
    image: [4, 2],
    material: "ABS pump body with drip sensor",
    medicalSpecialty: "Critical Care",
    mrp: 31500,
    name: "Infusion Pump",
    packSize: "1 pump",
    sterile: false,
    subcategory: "critical-care",
    unit: "unit",
    useCase: "controlled IV infusion delivery in ICU, emergency, and ward settings",
    variants: namedVariants([
      ["Single Channel", { channels: 1, batteryBackup: "4 hours" }, 1],
      ["Dual Channel", { channels: 2, batteryBackup: "5 hours" }, 1.48]
    ])
  }),
  product({
    brand: "contec",
    category: "equipment",
    disposable: false,
    image: [4, 3],
    material: "Compressor oxygen concentrator",
    medicalSpecialty: "Respiratory Care",
    mrp: 42000,
    name: "Oxygen Concentrator 5 LPM",
    packSize: "1 concentrator with humidifier bottle",
    sterile: false,
    subcategory: "critical-care",
    unit: "unit",
    useCase: "continuous oxygen support for wards, home-care programs, and clinics",
    variants: namedVariants([
      ["5 LPM", { flow: "0.5-5 LPM", purity: "93 percent" }, 1],
      ["10 LPM", { flow: "1-10 LPM", purity: "93 percent" }, 1.44]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "physiotherapy",
    disposable: false,
    image: [4, 4],
    material: "Steel frame with nylon upholstery",
    medicalSpecialty: "Mobility Support",
    mrp: 11500,
    name: "Foldable Wheelchair",
    packSize: "1 wheelchair",
    sterile: false,
    subcategory: "allied-products",
    unit: "unit",
    useCase: "safe assisted mobility for wards, discharge, and rehabilitation",
    variants: namedVariants([
      ["Standard Seat", { seatWidth: "18 inch", brakes: "Manual" }, 1],
      ["Wide Seat", { seatWidth: "20 inch", brakes: "Manual" }, 1.18]
    ])
  }),
  product({
    brand: "abbott",
    category: "vaccines",
    disposable: false,
    expirySensitive: true,
    image: [4, 5],
    material: "Insulated polymer carrier with gel packs",
    medicalSpecialty: "Cold Chain",
    mrp: 6500,
    name: "Vaccine Cold Chain Carrier",
    packSize: "1 carrier with 4 ice packs",
    sterile: false,
    unit: "unit",
    useCase: "temperature-controlled transport for immunization and outreach programs",
    variants: namedVariants([
      ["8 Liter", { capacity: "8 L", holdTime: "12 hours" }, 1],
      ["12 Liter", { capacity: "12 L", holdTime: "18 hours" }, 1.28]
    ])
  }),
  product({
    brand: "mb-plus",
    category: "physiotherapy",
    disposable: false,
    image: [4, 6],
    material: "Digital stimulator with reusable electrodes",
    medicalSpecialty: "Physiotherapy",
    mrp: 7800,
    name: "Portable TENS Therapy Unit",
    packSize: "1 unit with 4 electrode pads",
    sterile: false,
    subcategory: "allied-products",
    unit: "unit",
    useCase: "non-invasive pain-management therapy for supervised rehabilitation",
    variants: namedVariants([
      ["2 Channel", { channels: 2, programs: 8 }, 1],
      ["4 Channel", { channels: 4, programs: 12 }, 1.36]
    ])
  })
];

function product(input) {
  const sellingPrice = roundMoney(input.mrp * 0.82);
  return {
    basePrice: roundMoney(input.mrp * 0.62),
    disposable: false,
    expirySensitive: false,
    sellingPrice,
    sterile: false,
    taxRate: 18,
    ...input
  };
}

function namedVariants(entries) {
  return entries.map(([name, attributes, multiplier]) => ({
    attributes,
    multiplier,
    name
  }));
}

function sizeVariants(values, label) {
  return values.map((value, index) => ({
    attributes: {
      [label]: value
    },
    multiplier: index === 0 ? 1 : 1 + index * 0.08,
    name: value
  }));
}

const GENERATED_PRODUCT_FAMILIES = [
  "Clinical Starter Kit",
  "Procedure Pack",
  "Hospital Supply Set",
  "Advanced Care Unit",
  "Sterile Workflow Kit",
  "Procurement Bundle",
  "Ward Ready Pack",
  "Specialty Accessory Set"
];

const GENERATED_VARIANT_DIMENSIONS = [
  ["Standard", { specification: "Standard", pack: "Base pack" }, 1],
  ["Extended", { specification: "Extended", pack: "Extended pack" }, 1.12],
  ["Bulk", { specification: "Bulk", pack: "Bulk procurement pack" }, 1.24]
];

const GENERATED_PACK_SIZES = [
  "Pack of 5",
  "Pack of 10",
  "Box of 20",
  "Box of 50",
  "Set of 3",
  "1 clinical unit"
];

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const equalsIndex = line.indexOf("=");

        if (equalsIndex < 0) {
          return [line, ""];
        }

        const key = line.slice(0, equalsIndex).trim();
        const rawValue = line.slice(equalsIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");

        return [key, value];
      })
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnv() {
  return {
    ...readEnvFile(path.resolve(".env")),
    ...readEnvFile(path.resolve("apps/api/.env")),
    ...readEnvFile(path.resolve("apps/admin/.env.local")),
    ...process.env
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function skuFromName(name) {
  const sku = `DEMO-${slugify(name).toUpperCase()}`.slice(0, 80);

  if (sku.length < 76) {
    return sku;
  }

  const hashSuffix = `-${hashString(name).toString(36).toUpperCase().slice(0, 6)}`;
  return `${sku.slice(0, 80 - hashSuffix.length)}${hashSuffix}`;
}

function variantSkuFromProductSku(productSku, code) {
  const suffix = `-${code}`;

  return `${productSku.slice(0, 80 - suffix.length)}${suffix}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fitFontSize(value, base, min) {
  const length = String(value).length;
  if (length <= 12) {
    return base;
  }
  if (length <= 22) {
    return Math.max(min, base - 8);
  }
  return Math.max(min, base - 16);
}

function truncateText(value, maxLength) {
  const text = String(value ?? "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function wrapSvgText(value, maxChars, maxLines) {
  const words = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (next.length <= maxChars) {
      line = next;
      continue;
    }

    if (line) {
      lines.push(line);
    }

    line = word;

    if (lines.length === maxLines) {
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (words.join(" ").length > lines.join(" ").length && lines.length > 0) {
    lines[lines.length - 1] = truncateText(lines[lines.length - 1], maxChars);
  }

  return lines.length > 0 ? lines : ["Catalog product"];
}

function svgTextLines(lines, x, y, fontSize, lineHeight, attributes = "") {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-size="${fontSize}" ${attributes}>${escapeXml(line)}</text>`
    )
    .join("\n");
}

function productImagePalette(definition, viewConfig) {
  const index =
    hashString(`${definition.name}-${definition.category}-${definition.subcategory ?? "root"}-${viewConfig.key}`) %
    PRODUCT_IMAGE_PALETTES.length;

  return PRODUCT_IMAGE_PALETTES[index];
}

function productTileSvg(definition, viewConfig) {
  const palette = productImagePalette(definition, viewConfig);
  const hash = hashString(`${definition.name}-${viewConfig.key}`);
  const patternOffset = hash % 140;
  const productCode = skuFromName(definition.name).replace(/^DEMO-/, "").slice(0, 22);
  const categoryLabel = definition.subcategory
    ? `${definition.category} / ${definition.subcategory}`
    : definition.category;
  const nameLines = wrapSvgText(definition.name, 31, 3);
  const panelLines = [
    truncateText(definition.packSize, 34),
    truncateText(definition.material, 34),
    `${definition.variants.length} variants`
  ];
  const infoPanel =
    viewConfig.key === "specification"
      ? `
        <rect x="744" y="118" width="356" height="304" rx="24" fill="${palette.panel}" opacity="0.92"/>
        <text x="780" y="176" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700" fill="${palette.ink}">Specification</text>
        ${svgTextLines(panelLines, 780, 228, 22, 42, `font-family="Inter, Arial, sans-serif" fill="${palette.ink}" opacity="0.82"`)}
        <rect x="780" y="350" width="190" height="42" rx="21" fill="${palette.accent}" opacity="0.12"/>
        <text x="804" y="378" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="700" fill="${palette.accent}">${escapeXml(productCode)}</text>
      `
      : "";
  const packagePanel =
    viewConfig.key === "package"
      ? `
        <rect x="94" y="344" width="260" height="138" rx="18" fill="${palette.panel}" opacity="0.94"/>
        <path d="M126 384h196v62H126z" fill="${palette.accent}" opacity="0.10"/>
        <path d="M126 384l38-34h158l-32 34z" fill="${palette.accent}" opacity="0.18"/>
        <path d="M322 384l-32-34v96l32-32z" fill="${palette.accent}" opacity="0.24"/>
        <text x="126" y="528" font-size="21" font-family="Inter, Arial, sans-serif" font-weight="700" fill="${palette.ink}">${escapeXml(truncateText(definition.packSize, 26))}</text>
      `
      : "";

  return `
    <svg width="${PRODUCT_TILE_WIDTH}" height="${PRODUCT_TILE_HEIGHT}" viewBox="0 0 ${PRODUCT_TILE_WIDTH} ${PRODUCT_TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.bgStart}"/>
          <stop offset="1" stop-color="${palette.bgEnd}"/>
        </linearGradient>
        <pattern id="dot-grid" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="translate(${patternOffset} ${patternOffset / 2})">
          <circle cx="12" cy="12" r="3" fill="${palette.accent}" opacity="0.12"/>
        </pattern>
      </defs>
      <rect width="${PRODUCT_TILE_WIDTH}" height="${PRODUCT_TILE_HEIGHT}" fill="url(#bg)"/>
      <rect width="${PRODUCT_TILE_WIDTH}" height="${PRODUCT_TILE_HEIGHT}" fill="url(#dot-grid)"/>
      <circle cx="${1040 - (hash % 120)}" cy="${116 + (hash % 84)}" r="190" fill="${palette.accent}" opacity="0.08"/>
      <circle cx="${170 + (hash % 92)}" cy="${120 + (hash % 56)}" r="88" fill="${palette.accent}" opacity="0.10"/>
      <rect x="46" y="42" width="244" height="58" rx="29" fill="${palette.panel}" opacity="0.92"/>
      <text x="74" y="79" font-size="23" font-family="Inter, Arial, sans-serif" font-weight="800" fill="${palette.accent}">${escapeXml(viewConfig.label)}</text>
      <text x="184" y="79" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="600" fill="${palette.ink}" opacity="0.68">${escapeXml(viewConfig.subtitle)}</text>
      <rect x="48" y="494" width="392" height="104" rx="24" fill="${palette.panel}" opacity="0.92"/>
      ${svgTextLines(nameLines, 76, 532, 23, 28, `font-family="Inter, Arial, sans-serif" font-weight="800" fill="${palette.ink}"`)}
      <text x="76" y="586" font-size="17" font-family="Inter, Arial, sans-serif" font-weight="600" fill="${palette.ink}" opacity="0.62">${escapeXml(truncateText(categoryLabel, 39))}</text>
      ${infoPanel}
      ${packagePanel}
    </svg>
  `;
}

const BRAND_LOGO_SPECS = {
  abbott: {
    accent: "#18A999",
    initials: "A",
    mark: "pulse",
    primary: "#0E5DA8"
  },
  contec: {
    accent: "#1FB6D8",
    initials: "C",
    mark: "monitor",
    primary: "#0B6F8F"
  },
  gc: {
    accent: "#6EA8FE",
    initials: "GC",
    mark: "diamond",
    primary: "#234B8E"
  },
  healthium: {
    accent: "#20B486",
    initials: "H",
    mark: "cross",
    primary: "#123E66"
  },
  "j-mitra": {
    accent: "#EF5DA8",
    initials: "JM",
    mark: "lab",
    primary: "#7B2CBF"
  },
  "mb-plus": {
    accent: "#38BDF8",
    initials: "M+",
    mark: "plus",
    primary: "#0B5CAB"
  },
  orikam: {
    accent: "#22C55E",
    initials: "O",
    mark: "dental",
    primary: "#0F766E"
  },
  volk: {
    accent: "#A78BFA",
    initials: "V",
    mark: "lens",
    primary: "#4C1D95"
  }
};

function brandMarkSvg(spec) {
  const initials = escapeXml(spec.initials);

  if (spec.mark === "pulse") {
    return `
      <path d="M32 92H86L108 48L140 136L162 92H224" fill="none" stroke="${spec.primary}" stroke-width="18" stroke-linejoin="round" stroke-linecap="square"/>
      <path d="M34 150H220" stroke="${spec.accent}" stroke-width="18" stroke-linecap="square"/>
    `;
  }

  if (spec.mark === "monitor") {
    return `
      <rect x="34" y="42" width="178" height="116" fill="none" stroke="${spec.primary}" stroke-width="16"/>
      <path d="M62 104H92L114 76L142 130L166 104H190" fill="none" stroke="${spec.accent}" stroke-width="13" stroke-linejoin="round" stroke-linecap="square"/>
      <path d="M94 190H152M123 158V190" stroke="${spec.primary}" stroke-width="14" stroke-linecap="square"/>
    `;
  }

  if (spec.mark === "diamond") {
    return `
      <path d="M124 28L222 124L124 220L26 124Z" fill="${spec.primary}"/>
      <path d="M124 68L182 124L124 180L66 124Z" fill="${spec.accent}" opacity="0.92"/>
      <text x="124" y="139" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF">${initials}</text>
    `;
  }

  if (spec.mark === "cross") {
    return `
      <path d="M98 34H152V96H214V150H152V212H98V150H36V96H98Z" fill="${spec.primary}"/>
      <path d="M64 190H188" stroke="${spec.accent}" stroke-width="18" stroke-linecap="square" opacity="0.9"/>
    `;
  }

  if (spec.mark === "lab") {
    return `
      <path d="M82 30H166V66L212 176C220 196 206 218 184 218H64C42 218 28 196 36 176L82 66Z" fill="${spec.primary}"/>
      <path d="M70 158H178L190 188H58Z" fill="${spec.accent}"/>
      <path d="M88 64H160" stroke="#FFFFFF" stroke-width="16" stroke-linecap="square"/>
    `;
  }

  if (spec.mark === "plus") {
    return `
      <path d="M98 32H152V96H216V150H152V214H98V150H34V96H98Z" fill="${spec.primary}"/>
      <path d="M54 54L196 196" stroke="${spec.accent}" stroke-width="22" stroke-linecap="square"/>
    `;
  }

  if (spec.mark === "dental") {
    return `
      <path d="M54 44C96 22 152 22 194 44C176 74 170 118 166 166C162 208 138 220 124 176C110 220 86 208 82 166C78 118 72 74 54 44Z" fill="${spec.primary}"/>
      <path d="M80 78C112 64 136 64 168 78" fill="none" stroke="${spec.accent}" stroke-width="16" stroke-linecap="square"/>
    `;
  }

  return `
    <path d="M34 124C74 58 174 58 214 124C174 190 74 190 34 124Z" fill="${spec.primary}"/>
    <path d="M92 124C92 106 106 92 124 92C142 92 156 106 156 124C156 142 142 156 124 156C106 156 92 142 92 124Z" fill="${spec.accent}"/>
    <path d="M58 124H190" stroke="#FFFFFF" stroke-width="8" stroke-linecap="square" opacity="0.72"/>
  `;
}

function brandSvg(brand) {
  const spec = BRAND_LOGO_SPECS[brand.slug] ?? {
    accent: "#38BDF8",
    initials: brand.name.slice(0, 2).toUpperCase(),
    mark: "plus",
    primary: "#0B5CAB"
  };
  const fontSize = fitFontSize(brand.name, 72, 44);

  return `
    <svg width="720" height="260" viewBox="0 0 720 260" xmlns="http://www.w3.org/2000/svg">
      <rect width="720" height="260" fill="none"/>
      <g transform="translate(38 6)">
        ${brandMarkSvg(spec)}
      </g>
      <text x="300" y="126" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="${spec.primary}" letter-spacing="0">${escapeXml(brand.name)}</text>
      <path d="M302 160H610" stroke="${spec.accent}" stroke-width="12" stroke-linecap="square" opacity="0.9"/>
    </svg>
  `;
}

function categoryBackdropSvg() {
  return `
    <svg width="${CATEGORY_TILE_WIDTH}" height="${CATEGORY_TILE_HEIGHT}" viewBox="0 0 ${CATEGORY_TILE_WIDTH} ${CATEGORY_TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#F9FCFF"/>
          <stop offset="1" stop-color="#E5F3FF"/>
        </linearGradient>
      </defs>
      <rect width="${CATEGORY_TILE_WIDTH}" height="${CATEGORY_TILE_HEIGHT}" fill="url(#bg)"/>
    </svg>
  `;
}

async function renderPngFromSvg(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function removeConnectedLightBackground(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const stack = [];

  function pixelIndex(x, y) {
    return y * width + x;
  }

  function byteIndex(x, y) {
    return pixelIndex(x, y) * 4;
  }

  function isConnectedBackgroundLike(x, y) {
    const index = byteIndex(x, y);
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const min = Math.min(r, g, b);

    return a === 0 || (min > 232 && spread < 58);
  }

  function isSourceDividerLike(x, y) {
    const index = byteIndex(x, y);
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);

    return min > 174 && max < 235 && spread < 10;
  }

  function seed(x, y) {
    const index = pixelIndex(x, y);

    if (!visited[index] && isConnectedBackgroundLike(x, y)) {
      visited[index] = 1;
      stack.push([x, y]);
    }
  }

  for (let x = 0; x < width; x += 1) {
    seed(x, 0);
    seed(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    seed(0, y);
    seed(width - 1, y);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ];

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }

      const nextIndex = pixelIndex(nextX, nextY);

      if (!visited[nextIndex] && isConnectedBackgroundLike(nextX, nextY)) {
        visited[nextIndex] = 1;
        stack.push([nextX, nextY]);
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = pixelIndex(x, y);

      if (visited[index] || isSourceDividerLike(x, y)) {
        data[index * 4 + 3] = 0;
      }
    }
  }

  const transparent = await sharp(data, {
    raw: {
      channels: 4,
      height,
      width
    }
  })
    .png()
    .toBuffer();

  return sharp(transparent)
    .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 }, threshold: 1 })
    .png()
    .toBuffer();
}

async function extractProductCutout(definition) {
  const [sheetIndex, cellIndex] = definition.image;
  const sheet = SOURCE_SHEETS[sheetIndex];
  const sourcePath = path.join(GENERATED_IMAGE_DIR, sheet.file);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Generated product source image missing: ${sourcePath}`);
  }

  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error(`Unable to read image dimensions for ${sourcePath}`);
  }

  const leftRaw = Math.round((cellIndex * width) / sheet.cols);
  const rightRaw = Math.round(((cellIndex + 1) * width) / sheet.cols);
  const cropInsetX = Math.max(16, Math.round(width * 0.008));
  const left = Math.min(rightRaw - 1, leftRaw + cropInsetX);
  const right = Math.max(left + 1, rightRaw - cropInsetX);
  const crop = {
    height: Math.max(1, height - 48),
    left,
    top: 24,
    width: Math.max(1, right - left)
  };

  let cropBuffer = await sharp(sourcePath).extract(crop).png().toBuffer();

  try {
    const trimmed = await sharp(cropBuffer)
      .trim({ background: "#ffffff", threshold: 10 })
      .png()
      .toBuffer();
    const trimmedMetadata = await sharp(trimmed).metadata();

    if ((trimmedMetadata.width ?? 0) > 60 && (trimmedMetadata.height ?? 0) > 60) {
      cropBuffer = trimmed;
    }
  } catch {
    // A clean crop is better than failing the seed for a conservative trim miss.
  }

  try {
    cropBuffer = await removeConnectedLightBackground(cropBuffer);
  } catch {
    // Keep the original crop if background removal cannot confidently process it.
  }

  return cropBuffer;
}

async function resizeTransparentPng(input, width, height) {
  return sharp(input)
    .resize({
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "inside",
      height,
      withoutEnlargement: false,
      width
    })
    .png()
    .toBuffer();
}

function productGalleryViewByKey(key) {
  const viewConfig = PRODUCT_GALLERY_VIEWS.find((view) => view.key === key || view.fileSuffix === key);

  if (!viewConfig) {
    throw new Error(`Unknown product gallery view: ${key}`);
  }

  return viewConfig;
}

async function buildProductImage(definition, view = "main") {
  const viewConfig = typeof view === "string" ? productGalleryViewByKey(view) : view;
  const cropBuffer = await extractProductCutout(definition);
  const productBuffer = await resizeTransparentPng(
    cropBuffer,
    viewConfig.productBox.width,
    viewConfig.productBox.height
  );
  const productMetadata = await sharp(productBuffer).metadata();
  const hash = hashString(`${definition.name}-${viewConfig.key}-position`);
  const jitterX = (hash % 29) - 14;
  const jitterY = (Math.floor(hash / 29) % 19) - 9;
  const compositeLeft = Math.round(
    viewConfig.productBox.left +
      (viewConfig.productBox.width - (productMetadata.width ?? viewConfig.productBox.width)) / 2 +
      jitterX
  );
  const compositeTop = Math.round(
    viewConfig.productBox.top +
      (viewConfig.productBox.height - (productMetadata.height ?? viewConfig.productBox.height)) / 2 +
      jitterY
  );

  return sharp(Buffer.from(productTileSvg(definition, viewConfig)))
    .composite([
      {
        input: productBuffer,
        left: compositeLeft,
        top: compositeTop
      }
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const CATEGORY_PRODUCT_RULES = [
  {
    keywords: ["dental", "endodontic", "orthodontic", "restorative"],
    names: [
      "Dental Examination Mirror Probe Set",
      "LED Dental Curing Light Kit",
      "VPS Impression Cartridge Kit"
    ]
  },
  {
    keywords: ["ophthalm", "eye", "vision", "lens", "optical"],
    names: ["Ophthalmic Trial Lens Set", "Adjustable Trial Frame"]
  },
  {
    keywords: ["diagnostic", "monitor", "bp", "blood", "pressure", "pulse", "oximeter"],
    names: ["Digital Blood Pressure Monitor", "Fingertip Pulse Oximeter", "Portable ECG Monitor"]
  },
  {
    keywords: ["thermometer", "temperature", "fever"],
    names: ["Digital Clinical Thermometer"]
  },
  {
    keywords: ["respiratory", "nebulizer", "oxygen", "critical", "icu"],
    names: ["Compressor Nebulizer Kit", "Oxygen Concentrator 5 LPM", "Infusion Pump"]
  },
  {
    keywords: ["glucose", "diabetes", "lab", "test", "diagnostic-kit"],
    names: ["Glucose Monitoring Kit", "Vaccine Cold Chain Carrier"]
  },
  {
    keywords: ["surgical", "surgery", "instrument", "forceps", "scissor", "retractor", "scalpel"],
    names: [
      "Rochester Pean Artery Forceps",
      "Mayo Operating Scissors",
      "Reusable Scalpel Handle Blade Set"
    ]
  },
  {
    keywords: ["consumable", "disposable", "glove", "mask", "syringe", "cannula", "gauze", "suture", "drape"],
    names: ["Sterile Examination Glove Dispenser", "Luer Lock Syringe Set 5 ml", "Sterile Gauze Roll"]
  },
  {
    keywords: ["equipment", "hospital", "bed", "light", "pump", "wheelchair", "carrier"],
    names: ["Electric ICU Bed", "Mobile LED Examination Light", "Foldable Wheelchair"]
  },
  {
    keywords: ["orthopedic", "ortho", "rehab", "bandage", "collar", "physio", "therapy", "tens"],
    names: ["Crepe Bandage Roll Set", "Adjustable Cervical Collar", "Portable TENS Therapy Unit"]
  }
];

function productByName(name) {
  return PRODUCTS.find((product) => product.name === name);
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function selectCategoryProducts(category, rootName) {
  const haystack = `${category.slug} ${category.name} ${rootName ?? ""}`.toLowerCase();

  for (const rule of CATEGORY_PRODUCT_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.names.map(productByName).filter(Boolean);
    }
  }

  const directMatches = PRODUCTS.filter((product) => {
    const productText = [
      product.brand,
      product.category,
      product.subcategory,
      product.medicalSpecialty,
      product.name,
      product.useCase
    ]
      .join(" ")
      .toLowerCase();

    return haystack
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3)
      .some((token) => productText.includes(token));
  });

  if (directMatches.length > 0) {
    return directMatches.slice(0, 3);
  }

  const fallbackIndex = hashString(haystack) % PRODUCTS.length;
  return [
    PRODUCTS[fallbackIndex],
    PRODUCTS[(fallbackIndex + 9) % PRODUCTS.length],
    PRODUCTS[(fallbackIndex + 18) % PRODUCTS.length]
  ];
}

async function buildCategoryImage(category, rootName) {
  const selectedProducts = selectCategoryProducts(category, rootName).slice(0, 3);
  const positions = [
    { height: 460, left: 372, top: 86, width: 500 },
    { height: 330, left: 112, top: 188, width: 330 },
    { height: 318, left: 786, top: 210, width: 328 }
  ];
  const composites = [];

  for (let index = 0; index < selectedProducts.length; index += 1) {
    const cutout = await extractProductCutout(selectedProducts[index]);
    const position = positions[index];
    const image = await resizeTransparentPng(cutout, position.width, position.height);
    const metadata = await sharp(image).metadata();

    composites.push({
      input: image,
      left: Math.round(position.left + (position.width - (metadata.width ?? position.width)) / 2),
      top: Math.round(position.top + (position.height - (metadata.height ?? position.height)) / 2)
    });
  }

  return sharp(Buffer.from(categoryBackdropSvg()))
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function writeAsset(relativePath, buffer) {
  const outputPath = path.join(ASSET_DIR, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

function flattenCategories(categories, root = null) {
  const flattened = [];

  for (const category of categories) {
    const currentRoot = root ?? category;
    flattened.push({
      ...category,
      rootName: currentRoot.name,
      rootSlug: currentRoot.slug
    });
    flattened.push(...flattenCategories(category.children ?? [], currentRoot));
  }

  return flattened;
}

function productLeafCategories(categories) {
  const flattened = flattenCategories(categories);
  const byId = new Map(flattened.map((category) => [category.id, category]));
  const parentIds = new Set(
    flattened.map((category) => category.parentId).filter(Boolean)
  );

  return flattened
    .filter((category) => !parentIds.has(category.id))
    .map((category) => {
      if (!category.parentId) {
        return category;
      }

      const parent = byId.get(category.parentId);

      return {
        ...category,
        rootName: parent?.rootName ?? parent?.name ?? category.rootName,
        rootSlug: parent?.rootSlug ?? parent?.slug ?? category.rootSlug
      };
    })
    .sort((first, second) =>
      `${first.rootSlug ?? first.slug}/${first.slug}`.localeCompare(
        `${second.rootSlug ?? second.slug}/${second.slug}`
      )
    );
}

function buildCatalogProductDefinitions(
  categories,
  brands = [],
  options = {}
) {
  const targetCount = Math.max(PRODUCTS.length, options.targetCount ?? PRODUCT_TARGET_COUNT);
  const definitions = [...PRODUCTS];
  const leaves = productLeafCategories(categories);

  if (leaves.length === 0) {
    return definitions.slice(0, targetCount);
  }

  let index = 0;
  while (definitions.length < targetCount) {
    const category = leaves[index % leaves.length];
    definitions.push(buildGeneratedProductDefinition(category, index, brands, leaves.length));
    index += 1;
  }

  return definitions.slice(0, targetCount);
}

function displayCategoryName(category) {
  if (category.parentId && category.rootName && category.rootName !== category.name) {
    return `${category.rootName} ${category.name}`;
  }

  return category.name;
}

function buildGeneratedProductDefinition(category, index, brands, leafCount = 1) {
  const rootSlug = category.rootSlug ?? category.slug;
  const isSubcategory = Boolean(category.parentId);
  const selectedProducts = selectCategoryProducts(category, category.rootName);
  const template = selectedProducts[index % selectedProducts.length] ?? PRODUCTS[index % PRODUCTS.length];
  const availableBrandSlugs = brands.length > 0
    ? brands.map((brand) => brand.slug)
    : uniqueStrings(PRODUCTS.map((item) => item.brand));
  const brand = availableBrandSlugs[hashString(`${category.slug}-${index}`) % availableBrandSlugs.length];
  const family = GENERATED_PRODUCT_FAMILIES[index % GENERATED_PRODUCT_FAMILIES.length];
  const sequence = Math.floor(index / Math.max(1, leafCount)) + 1;
  const categoryLabel = displayCategoryName(category);
  const name = `${categoryLabel} ${family} Series ${String(index + 1).padStart(3, "0")}`;
  const priceMultiplier = 0.86 + (hashString(name) % 42) / 100;
  const mrp = Math.max(240, roundMoney(template.mrp * priceMultiplier));

  return product({
    brand,
    category: rootSlug,
    disposable: template.disposable,
    expirySensitive: template.expirySensitive,
    image: template.image,
    material: template.material,
    medicalSpecialty: category.rootName ?? template.medicalSpecialty,
    mrp,
    name,
    packSize: GENERATED_PACK_SIZES[index % GENERATED_PACK_SIZES.length],
    sterile: template.sterile,
    subcategory: isSubcategory ? category.slug : undefined,
    taxRate: template.taxRate,
    unit: template.unit,
    useCase: `${categoryLabel.toLowerCase()} procurement, clinical storage, and department-level usage`,
    variants: buildGeneratedVariants(category, index, sequence, categoryLabel)
  });
}

function buildGeneratedVariants(category, index, sequence, categoryLabel = category.name) {
  const dimension = category.name.toLowerCase().includes("equipment")
    ? "Model"
    : category.name.toLowerCase().includes("pharma")
      ? "Specification"
      : "Pack option";

  return GENERATED_VARIANT_DIMENSIONS.map(([name, attributes, multiplier], variantIndex) => ({
    attributes: {
      ...attributes,
      [dimension]: `${categoryLabel} ${variantIndex + 1}`,
      series: `S${sequence}`
    },
    multiplier,
    name
  }));
}

class AdminApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.accessToken = null;
    this.loginEmail = null;
    this.loginPassword = null;
    this.lastRequestAt = 0;
  }

  async login(email, password) {
    this.loginEmail = email;
    this.loginPassword = password;

    return this.refreshLogin();
  }

  async refreshLogin() {
    if (!this.loginEmail || !this.loginPassword) {
      throw new Error("Admin login credentials are not available for token refresh.");
    }

    const session = await this.request("/auth/admin/login", {
      body: {
        email: this.loginEmail,
        password: this.loginPassword
      },
      method: "POST",
      skipAuth: true
    });

    this.accessToken = session.tokens.accessToken;
    return session;
  }

  async request(apiPath, options = {}) {
    const url = new URL(`${this.baseUrl}${apiPath}`);

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      ...(options.headers ?? {})
    };
    const init = {
      method: options.method ?? "GET",
      headers
    };

    if (!options.skipAuth) {
      if (!this.accessToken) {
        throw new Error("Admin access token is not available.");
      }
      headers.authorization = `Bearer ${this.accessToken}`;
    }

    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    if (options.formData) {
      init.body = options.formData;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await this.pace();

      const response = await fetch(url, init);
      const text = await response.text();
      let payload = null;

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 65000;
        console.log(`rate limit reached; waiting ${Math.round(waitMs / 1000)}s before retrying ${apiPath}`);
        await sleep(waitMs);
        continue;
      }

      if ([502, 503, 504].includes(response.status) && attempt < 3) {
        const waitMs = 5000 * (attempt + 1);
        console.log(
          `temporary gateway error (${response.status}); waiting ${Math.round(waitMs / 1000)}s before retrying ${apiPath}`
        );
        await sleep(waitMs);
        continue;
      }

      if (response.status === 401 && !options.skipAuth && attempt < 3) {
        console.log(`admin session expired; refreshing login before retrying ${apiPath}`);
        await this.refreshLogin();
        headers.authorization = `Bearer ${this.accessToken}`;
        continue;
      }

      if (!response.ok || payload?.success === false) {
        const message = Array.isArray(payload?.error?.message)
          ? payload.error.message.join("; ")
          : payload?.error?.message ?? payload?.message ?? text;

        throw new Error(`${init.method} ${apiPath} failed (${response.status}): ${message}`);
      }

      if (payload && typeof payload === "object" && "data" in payload) {
        return payload.data;
      }

      return payload;
    }

    throw new Error(`${init.method} ${apiPath} failed: retry limit exceeded.`);
  }

  async pace() {
    const elapsed = Date.now() - this.lastRequestAt;
    const remaining = REQUEST_INTERVAL_MS - elapsed;

    if (remaining > 0) {
      await sleep(remaining);
    }

    this.lastRequestAt = Date.now();
  }

  async uploadPng(buffer, filename, purpose) {
    const formData = new FormData();
    formData.append("purpose", purpose);
    formData.append("file", new Blob([buffer], { type: "image/png" }), filename);

    return this.request("/uploads/image", {
      formData,
      method: "POST"
    });
  }
}

async function listAllProducts(api) {
  const items = [];
  let page = 1;

  while (true) {
    const response = await api.request("/admin/products", {
      query: {
        limit: 100,
        page
      }
    });
    items.push(...response.items);

    if (!response.pagination?.hasNextPage) {
      break;
    }

    page += 1;
  }

  return items;
}

async function listAllPublicProducts(api, query = {}) {
  const items = [];
  let page = 1;

  while (true) {
    const response = await api.request("/products", {
      query: {
        ...query,
        limit: 100,
        page
      },
      skipAuth: true
    });
    items.push(...response.items);

    if (!response.pagination?.hasNextPage) {
      break;
    }

    page += 1;
  }

  return items;
}

async function listAllInventoryForProduct(api, productId) {
  const items = [];
  let page = 1;

  while (true) {
    const response = await api.request("/admin/inventory", {
      query: {
        limit: 100,
        page,
        productId
      }
    });
    items.push(...response.items);

    if (!response.pagination?.hasNextPage) {
      break;
    }

    page += 1;
  }

  return items;
}

async function ensureBrandImages(api, brands) {
  if (SKIP_BRAND_IMAGES) {
    return brands;
  }

  const updated = [];

  for (const brand of brands) {
    if (isUsableUploadUrl(brand.logoUrl) && !REFRESH_BRAND_IMAGES) {
      updated.push(brand);
      continue;
    }

    const image = await renderPngFromSvg(brandSvg(brand));
    const filename = `${brand.slug}-${ASSET_VERSION}.png`;
    writeAsset(`brands/${filename}`, image);
    const upload = await api.uploadPng(image, filename, "brand_logo");
    const patched = await api.request(`/admin/brands/${encodeURIComponent(brand.id)}`, {
      body: {
        description: BRAND_DESCRIPTIONS[brand.slug] ?? `${brand.name} catalog brand for clinical supplies.`,
        isActive: true,
        logoUrl: toAbsoluteUploadUrl(upload.url)
      },
      method: "PATCH"
    });
    updated.push(patched);
  }

  return updated;
}

async function ensureCategoryImages(api, categories) {
  if (SKIP_CATEGORY_IMAGES) {
    return categories;
  }

  const flattened = flattenCategories(categories);
  const updated = [];

  for (const category of flattened) {
    if (isUsableUploadUrl(category.imageUrl) && !REFRESH_CATEGORY_IMAGES) {
      updated.push(category);
      continue;
    }

    const image = await buildCategoryImage(category, category.rootName);
    const filename = `${category.slug}-${ASSET_VERSION}.png`;
    writeAsset(`categories/${filename}`, image);
    const upload = await api.uploadPng(image, filename, "category_image");
    const patched = await api.request(`/admin/categories/${encodeURIComponent(category.id)}`, {
      body: {
        description:
          category.description ??
          `${category.name} supplies for verified medical and clinical catalog workflows.`,
        imageUrl: toAbsoluteUploadUrl(upload.url),
        isActive: true
      },
      method: "PATCH"
    });
    updated.push(patched);
  }

  return updated;
}

async function ensureWarehouses(api) {
  const current = await api.request("/admin/warehouses", {
    query: {
      limit: 100
    }
  });
  const byCode = new Map(current.items.map((warehouse) => [warehouse.code, warehouse]));
  const result = [];

  for (const warehouse of WAREHOUSES) {
    const existing = byCode.get(warehouse.code);
    const saved = existing
      ? await api.request(`/admin/warehouses/${encodeURIComponent(existing.id)}`, {
          body: warehouse,
          method: "PATCH"
        })
      : await api.request("/admin/warehouses", {
          body: warehouse,
          method: "POST"
        });

    result.push(saved);
  }

  return result;
}

async function ensureProducts(api, brands, categories) {
  const brandsBySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  const categoriesBySlug = new Map(flattenCategories(categories).map((category) => [category.slug, category]));
  const existingProducts = await listAllProducts(api);
  const existingBySlug = new Map(existingProducts.map((item) => [item.slug, item]));
  const definitions = buildCatalogProductDefinitions(categories, brands);
  const currentDemoSlugs = new Set(
    definitions.map((definition) => `demo-${slugify(definition.name)}`)
  );
  const savedProducts = [];

  for (const definition of definitions) {
    const imageSlug = slugify(definition.name);
    const existing = existingBySlug.get(`demo-${imageSlug}`);
    let imageUrls = distinctExistingGalleryUrls(existing);

    if (!imageUrls || REFRESH_PRODUCT_IMAGES) {
      imageUrls = [];

      for (const viewConfig of PRODUCT_GALLERY_VIEWS) {
        const filename = `${imageSlug}-${viewConfig.fileSuffix}-${ASSET_VERSION}.png`;
        const assetPath = path.join(ASSET_DIR, "products", filename);
        const image = fs.existsSync(assetPath)
          ? fs.readFileSync(assetPath)
          : await buildProductImage(definition, viewConfig);

        if (!fs.existsSync(assetPath)) {
          writeAsset(`products/${filename}`, image);
        }

        const upload = await api.uploadPng(image, filename, "product_image");
        imageUrls.push(toAbsoluteUploadUrl(upload.url));
      }
    }

    const payload = buildProductPayload(definition, imageUrls, brandsBySlug, categoriesBySlug);
    let saved;

    if (existing) {
      await api.request(`/admin/products/${encodeURIComponent(existing.id)}`, {
        body: {
          variants: []
        },
        method: "PATCH"
      });
      saved = await api.request(`/admin/products/${encodeURIComponent(existing.id)}`, {
        body: payload,
        method: "PATCH"
      });
    } else {
      saved = await api.request("/admin/products", {
        body: payload,
        method: "POST"
      });
    }

    savedProducts.push(saved);
    console.log(`product ${savedProducts.length}/${definitions.length}: ${saved.name}`);
  }

  if (PRUNE_STALE_DEMO_PRODUCTS) {
    const staleDemoProducts = existingProducts.filter(
      (productItem) =>
        productItem.slug?.startsWith("demo-") && !currentDemoSlugs.has(productItem.slug)
    );

    for (const productItem of staleDemoProducts) {
      await api.request(`/admin/products/${encodeURIComponent(productItem.id)}`, {
        method: "DELETE"
      });
      console.log(`retired stale demo product: ${productItem.name}`);
    }
  }

  return savedProducts;
}

function normalizedImageUrl(value) {
  return String(value ?? "").split("?")[0];
}

function isUsableUploadUrl(value) {
  const rawValue = String(value ?? "").trim();

  return Boolean(rawValue) && !/%3CUNKNOWN%3E|<UNKNOWN>/i.test(rawValue);
}

function toAbsoluteUploadUrl(value) {
  const rawValue = String(value ?? "").trim();
  // Railway's upload service may return '<UNKNOWN>/catalog/...' when its
  // public-base environment value is not available. Treat that as the
  // managed uploads path instead of persisting a broken encoded URL.
  const normalizedValue = rawValue.replace(/^<[^>]+>\/?/, "/");

  try {
    return new URL(normalizedValue).toString();
  } catch {
    // Uploads from a proxied API can be returned as a root-relative path.
  }

  const uploadPublicBaseUrl = process.env.DEMO_SEED_UPLOAD_PUBLIC_BASE_URL ?? "";

  if (!uploadPublicBaseUrl) {
    throw new Error(
      "DEMO_SEED_UPLOAD_PUBLIC_BASE_URL is required when uploads return relative URLs."
    );
  }

  return new URL(normalizedValue, uploadPublicBaseUrl).toString();
}

function distinctExistingGalleryUrls(productItem) {
  const images = [...(productItem?.images ?? [])]
    .filter((image) => image.url)
    .sort((first, second) => {
      if (first.isPrimary && !second.isPrimary) {
        return -1;
      }
      if (!first.isPrimary && second.isPrimary) {
        return 1;
      }
      return (first.sortOrder ?? 0) - (second.sortOrder ?? 0);
    });
  const urls = images.slice(0, PRODUCT_GALLERY_VIEWS.length).map((image) => image.url);
  const distinctFiles = new Set(urls.map(normalizedImageUrl));

  if (
    urls.length < PRODUCT_GALLERY_VIEWS.length ||
    distinctFiles.size < PRODUCT_GALLERY_VIEWS.length ||
    !urls.every((url) => url.includes(ASSET_VERSION) && isUsableUploadUrl(url))
  ) {
    return null;
  }

  return urls;
}

function buildProductPayload(definition, imageUrls, brandsBySlug, categoriesBySlug) {
  const brand = brandsBySlug.get(definition.brand);
  const category = categoriesBySlug.get(definition.category);
  const subcategory = definition.subcategory
    ? categoriesBySlug.get(definition.subcategory)
    : null;

  if (!brand) {
    throw new Error(`Missing brand ${definition.brand} for ${definition.name}`);
  }
  if (!category) {
    throw new Error(`Missing category ${definition.category} for ${definition.name}`);
  }
  if (definition.subcategory && !subcategory) {
    throw new Error(`Missing subcategory ${definition.subcategory} for ${definition.name}`);
  }

  const slug = `demo-${slugify(definition.name)}`;
  const sku = skuFromName(definition.name);
  const tags = uniqueStrings([
    "demo",
    definition.category,
    definition.subcategory,
    definition.brand,
    definition.medicalSpecialty,
    ...slugify(definition.name).split("-")
  ]).slice(0, 30);

  return {
    basePrice: definition.basePrice,
    brandId: brand.id,
    categoryId: category.id,
    description: buildDescription(definition),
    disposable: definition.disposable,
    expirySensitive: definition.expirySensitive,
    documents: buildProductDocuments(definition, slug),
    images: buildProductImageGallery(definition, imageUrls),
    material: definition.material,
    medicalSpecialty: definition.medicalSpecialty,
    metaDescription: `${definition.name} with variants, catalog image, and stocked demo inventory.`,
    metaTitle: definition.name,
    mrp: definition.mrp,
    name: definition.name,
    packSize: definition.packSize,
    searchTags: tags,
    sellingPrice: definition.sellingPrice,
    shortDescription: conciseShortDescription(definition),
    sku,
    slug,
    status: "ACTIVE",
    sterile: definition.sterile,
    subcategoryId: subcategory?.id ?? null,
    taxRate: definition.taxRate,
    unit: definition.unit,
    variants: buildVariants(definition, sku)
  };
}

function buildProductImageGallery(definition, imageUrls) {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls].filter(Boolean);
  const distinctFiles = new Set(urls.map(normalizedImageUrl));

  if (urls.length < PRODUCT_GALLERY_VIEWS.length || distinctFiles.size < PRODUCT_GALLERY_VIEWS.length) {
    throw new Error(`${definition.name} requires ${PRODUCT_GALLERY_VIEWS.length} distinct gallery image URLs.`);
  }

  return PRODUCT_GALLERY_VIEWS.map((viewConfig, index) => ({
    altText: `${definition.name} ${viewConfig.alt}`,
    isPrimary: index === 0,
    sortOrder: viewConfig.sortOrder,
    url: urls[index]
  }));
}

function buildProductDocuments(definition, slug) {
  const basePath = `https://cdn.example.com/demo-catalog/products/${slug}`;

  return [
    {
      fileKey: `demo-catalog/products/${slug}/customer-manual.pdf`,
      fileUrl: `${basePath}/customer-manual.pdf`,
      title: `${definition.name} Customer Manual`,
      type: "MANUAL"
    },
    {
      fileKey: `demo-catalog/products/${slug}/warranty.pdf`,
      fileUrl: `${basePath}/warranty.pdf`,
      title: `${definition.name} Warranty Statement`,
      type: "WARRANTY"
    },
    {
      fileKey: `demo-catalog/products/${slug}/compliance.pdf`,
      fileUrl: `${basePath}/compliance.pdf`,
      title: `${definition.name} Compliance File`,
      type: "COMPLIANCE"
    },
    {
      fileKey: `demo-catalog/products/${slug}/certificate.pdf`,
      fileUrl: `${basePath}/certificate.pdf`,
      title: `${definition.name} Customer-visible Certificate`,
      type: "CERTIFICATE"
    }
  ];
}

function conciseShortDescription(definition) {
  return `${definition.packSize} for ${definition.useCase}.`;
}

function buildDescription(definition) {
  const variants = definition.variants.map((variant) => variant.name).join(", ");
  const storage = definition.expirySensitive
    ? "Store in a clean, dry clinical storage area and rotate stock by expiry."
    : "Store in a clean, dry clinical storage area away from direct heat.";

  return [
    `<p>${escapeXml(definition.name)} is a detailed dummy catalog product prepared for realistic admin and storefront validation.</p>`,
    `<p>It is intended for ${escapeXml(definition.useCase)} and includes pricing, inventory, image, and variant data for end-to-end workflow checks.</p>`,
    "<ul>",
    `<li>Pack size: ${escapeXml(definition.packSize)}</li>`,
    `<li>Material: ${escapeXml(definition.material)}</li>`,
    `<li>Available variants: ${escapeXml(variants)}</li>`,
    `<li>${escapeXml(storage)}</li>`,
    "</ul>"
  ].join("");
}

function buildVariants(definition, sku) {
  return definition.variants.map((variant, index) => {
    const code = slugify(variant.name).toUpperCase().replace(/-/g, "_").slice(0, 18) || `V${index + 1}`;
    const multiplier = variant.multiplier ?? 1;

    return {
      attributes: {
        ...variant.attributes,
        packSize: definition.packSize,
        sterile: definition.sterile
      },
      mrp: roundMoney(definition.mrp * multiplier),
      name: variant.name,
      sellingPrice: roundMoney(definition.sellingPrice * multiplier),
      sku: variantSkuFromProductSku(sku, code),
      status: "ACTIVE"
    };
  });
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).toLowerCase()))];
}

async function ensureInventory(api, products, warehouses) {
  let createdOrExisting = 0;

  for (const [index, productItem] of products.entries()) {
    const existingStocks = await listAllInventoryForProduct(api, productItem.id);
    const warehouseChoices = [
      warehouses[index % warehouses.length],
      warehouses[(index + 2) % warehouses.length],
      ...(index % 3 === 0 ? [warehouses[(index + 4) % warehouses.length]] : [])
    ];

    for (const [warehouseIndex, warehouse] of warehouseChoices.entries()) {
      const existing = existingStocks.find(
        (stock) =>
          stock.productId === productItem.id &&
          stock.warehouseId === warehouse.id &&
          stock.variantId === null &&
          stock.availableQuantity > 0
      );

      if (existing) {
        createdOrExisting += 1;
        continue;
      }

      await api.request("/admin/inventory/stock-in", {
        body: {
          batchNumber: `${productItem.sku}-${warehouse.code}`,
          ...(productItem.expirySensitive ? { expiryDate: "2030-06-30" } : {}),
          lowStockThreshold: 5 + (index % 4),
          mrp: productItem.mrp,
          notes: "Seeded demo catalog inventory for admin and storefront flow verification.",
          productId: productItem.id,
          purchasePrice: roundMoney(productItem.basePrice * 0.9),
          quantity: 12 + ((index + warehouseIndex) % 9),
          sellingPrice: productItem.sellingPrice,
          warehouseId: warehouse.id
        },
        method: "POST"
      });
      createdOrExisting += 1;
    }
  }

  return createdOrExisting;
}

async function verifySeed(api, products, brands, categories, warehouses) {
  const productSlugs = new Set(products.map((item) => item.slug));
  const latestProducts = (await listAllProducts(api)).filter((item) => productSlugs.has(item.slug));
  const productGalleryCount = latestProducts.filter((item) => (item.images ?? []).length >= 3).length;
  const productDocumentCount = latestProducts.filter((item) => (item.documents ?? []).length >= 4).length;
  const productVariantCount = latestProducts.filter((item) => (item.variants ?? []).length >= 2).length;
  const stockedProductIds = new Set();
  let inventoryRecordCount = 0;

  for (const productItem of latestProducts) {
    const inventory = await listAllInventoryForProduct(api, productItem.id);
    const positive = inventory.filter((stock) => stock.availableQuantity > 0);
    inventoryRecordCount += positive.length;

    if (positive.length > 0) {
      stockedProductIds.add(productItem.id);
    }
  }

  const publicProducts = await listAllPublicProducts(api, {
    search: "demo"
  });
  const publicDemoProducts = publicProducts.filter((item) => productSlugs.has(item.slug));
  const publicCategories = await api.request("/categories", { skipAuth: true });
  const publicBrands = await api.request("/brands", { skipAuth: true });
  const flatPublicCategories = flattenCategories(publicCategories);
  const categoryCoverage = new Set(latestProducts.map((item) => item.category.slug)).size;
  const subcategoryCoverage = new Set(
    latestProducts.map((item) => item.subcategory?.slug).filter(Boolean)
  ).size;

  return {
    adminProducts: latestProducts.length,
    brandImages: brands.filter((brand) => brand.logoUrl).length,
    categoryImages: flattenCategories(categories).filter((category) => category.imageUrl).length,
    categoryCoverage,
    inventoryRecords: inventoryRecordCount,
    productDocuments: productDocumentCount,
    productGalleries: productGalleryCount,
    productVariants: productVariantCount,
    publicBrandImages: publicBrands.filter((brand) => brand.logoUrl).length,
    publicCategoryImages: flatPublicCategories.filter((category) => category.imageUrl).length,
    publicProducts: publicDemoProducts.length,
    stockedProducts: stockedProductIds.size,
    subcategoryCoverage,
    warehouses: warehouses.length
  };
}

async function main() {
  const env = loadEnv();
  const apiBase = env.NEXT_PUBLIC_API_URL || API_BASE_DEFAULT;
  const adminEmail = env.SEED_SUPER_ADMIN_EMAIL || "superadmin@admin.com";
  const adminPassword = env.SEED_SUPER_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD is required in apps/api/.env or process env.");
  }

  fs.mkdirSync(ASSET_DIR, { recursive: true });

  const api = new AdminApi(apiBase);
  await api.login(adminEmail, adminPassword);
  console.log(`authenticated admin: ${adminEmail}`);

  const brands = await api.request("/admin/brands");
  const categories = await api.request("/admin/categories");
  console.log(`catalog inputs: ${brands.length} brands, ${flattenCategories(categories).length} categories`);

  const updatedBrands = await ensureBrandImages(api, brands);
  console.log(`brand images uploaded: ${updatedBrands.length}`);

  const updatedCategories = await ensureCategoryImages(api, categories);
  console.log(`category images uploaded: ${updatedCategories.length}`);

  const warehouses = await ensureWarehouses(api);
  console.log(`warehouses ready: ${warehouses.length}`);

  const products = await ensureProducts(api, updatedBrands, updatedCategories);
  console.log(`products ready: ${products.length}`);

  const inventoryRecords = await ensureInventory(api, products, warehouses);
  console.log(`inventory combinations ready: ${inventoryRecords}`);

  const refreshedBrands = await api.request("/admin/brands");
  const refreshedCategories = await api.request("/admin/categories");
  const verification = await verifySeed(api, products, refreshedBrands, refreshedCategories, warehouses);
  console.log("verification:");
  console.log(JSON.stringify(verification, null, 2));
}

module.exports = {
  buildCatalogProductDefinitions,
  buildProductImageGallery,
  buildProductPayload,
  distinctExistingGalleryUrls,
  flattenCategories,
  productLeafCategories,
  skuFromName,
  toAbsoluteUploadUrl
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
