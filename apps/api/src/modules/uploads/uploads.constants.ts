export enum UploadImagePurpose {
  BrandLogo = "brand_logo",
  CategoryImage = "category_image",
  ProductImage = "product_image"
}

export enum UploadDocumentPurpose {
  CustomerDocument = "customer_document",
  DeliveryProof = "delivery_proof",
  DeliveryPartnerDocument = "delivery_partner_document",
  ProductDocument = "product_document"
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
export const UPLOAD_OPTIONS = Symbol("UPLOAD_OPTIONS");

export const IMAGE_MAX_BYTES_DEFAULT = 5 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES_DEFAULT = 10 * 1024 * 1024;
