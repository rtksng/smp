type ProductPriceInput = {
  mrp: number;
  sellingPrice: number;
};

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency"
});

export function formatRupees(value: number) {
  return rupeeFormatter.format(value);
}

export function getProductSavings(product: ProductPriceInput) {
  const amount = product.mrp - product.sellingPrice;

  if (amount <= 0 || product.mrp <= 0) {
    return null;
  }

  return {
    amount,
    percent: Math.round((amount / product.mrp) * 100)
  };
}
