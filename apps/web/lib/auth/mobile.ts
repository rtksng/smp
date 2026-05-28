const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export function normalizeIndianMobileNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  const nationalNumber = toIndianNationalNumber(digits);

  if (!nationalNumber || !INDIAN_MOBILE_PATTERN.test(nationalNumber)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }

  return `+91${nationalNumber}`;
}

export function isValidIndianMobileNumber(input: string) {
  try {
    normalizeIndianMobileNumber(input);
    return true;
  } catch {
    return false;
  }
}

function toIndianNationalNumber(digits: string) {
  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return null;
}
