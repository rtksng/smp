import { formatCurrency } from "../api/status";
import type { DeliveryStatus } from "../api/types";

type ValidationResult<TValues, TErrors extends Record<string, string>> = {
  errors: Partial<TErrors>;
  isValid: boolean;
  values: TValues;
};

type LoginErrors = {
  mobileNumber: string;
  otp: string;
};

type RegistrationErrors = {
  email: string;
  fullName: string;
  mobileNumber: string;
};

type StatusFormErrors = {
  cashCollectedAmount: string;
  failureReason: string;
  proof: string;
  receiverName: string;
};

export function normalizeMobileNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const nationalNumber = toIndianNationalNumber(digits);

  if (!nationalNumber || !/^[6-9]\d{9}$/.test(nationalNumber)) {
    return "";
  }

  return `+91${nationalNumber}`;
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

export function validateLoginForm(input: {
  mobileNumber: string;
  otp: string;
  otpRequested: boolean;
}): ValidationResult<
  { mobileNumber: string; otp: string },
  LoginErrors
> {
  const values = {
    mobileNumber: normalizeMobileNumber(input.mobileNumber),
    otp: input.otp.trim()
  };
  const errors: Partial<LoginErrors> = {};

  if (!values.mobileNumber) {
    errors.mobileNumber = "Enter a valid 10 digit Indian mobile number.";
  }

  if (input.otpRequested && !/^\d{6}$/.test(values.otp)) {
    errors.otp = "Enter the 6 digit OTP.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values
  };
}

export function validateRegistrationForm(input: {
  email: string;
  fullName: string;
  mobileNumber: string;
  vehicleNumber: string;
}): ValidationResult<
  {
    email?: string;
    fullName: string;
    mobileNumber: string;
    vehicleNumber?: string;
  },
  RegistrationErrors
> {
  const values = {
    email: input.email.trim() || undefined,
    fullName: input.fullName.trim(),
    mobileNumber: normalizeMobileNumber(input.mobileNumber),
    vehicleNumber: input.vehicleNumber.trim().toUpperCase() || undefined
  };
  const errors: Partial<RegistrationErrors> = {};

  if (values.fullName.length < 3) {
    errors.fullName = "Enter the driver's full name.";
  }

  if (!values.mobileNumber) {
    errors.mobileNumber = "Enter a valid 10 digit Indian mobile number.";
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values
  };
}

export function validateDeliveryStatusForm(input: {
  cashCollectedAmount: string;
  expectedCodAmount: number;
  failureReason: string;
  isCod: boolean;
  proofSelected: boolean;
  receiverName: string;
  status: DeliveryStatus;
}): ValidationResult<
  {
    cashCollectedAmount?: number;
    failureReason?: string;
    receiverName?: string;
  },
  StatusFormErrors
> {
  const cashCollectedAmount = input.cashCollectedAmount.trim()
    ? Number(input.cashCollectedAmount)
    : undefined;
  const values = {
    cashCollectedAmount,
    failureReason: input.failureReason.trim() || undefined,
    receiverName: input.receiverName.trim() || undefined
  };
  const errors: Partial<StatusFormErrors> = {};

  if (input.status === "DELIVERED") {
    if (!input.proofSelected) {
      errors.proof = "Attach proof of delivery.";
    }

    if (!values.receiverName) {
      errors.receiverName = "Enter receiver name.";
    }

    if (input.isCod) {
      if (
        cashCollectedAmount === undefined ||
        Number.isNaN(cashCollectedAmount) ||
        cashCollectedAmount < input.expectedCodAmount
      ) {
        errors.cashCollectedAmount = `Collect at least ${formatCurrency(
          input.expectedCodAmount
        ).replace("₹", "INR ")} before marking delivered.`;
      }
    }
  }

  if (input.status === "FAILED" && !values.failureReason) {
    errors.failureReason = "Enter a failure reason.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values
  };
}
