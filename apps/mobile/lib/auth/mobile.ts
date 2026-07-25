export function normalizeIndianMobileNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  const nationalNumber =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error("Enter a valid 10 digit Indian mobile number.");
  }

  return `+91${nationalNumber}`;
}

export function normalizeOtpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}
