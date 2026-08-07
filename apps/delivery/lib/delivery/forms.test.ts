import { describe, expect, test } from "vitest";
import {
  validateDeliveryStatusForm,
  validateLoginForm,
  validateRegistrationForm
} from "./forms";

describe("delivery form validation", () => {
  test("requires a usable mobile number before requesting OTP", () => {
    expect(validateLoginForm({ mobileNumber: "", otp: "", otpRequested: false })).toEqual({
      isValid: false,
      values: {
        mobileNumber: "",
        otp: ""
      },
      errors: {
        mobileNumber: "Enter a valid 10 digit Indian mobile number."
      }
    });
  });

  test("requires a six digit OTP after OTP is requested", () => {
    expect(
      validateLoginForm({
        mobileNumber: " 99999 88888 ",
        otp: "12",
        otpRequested: true
      })
    ).toMatchObject({
      isValid: false,
      errors: {
        otp: "Enter the 6 digit OTP."
      },
      values: {
        mobileNumber: "+919999988888"
      }
    });
  });

  test("normalizes valid login values", () => {
    expect(
      validateLoginForm({
        mobileNumber: "+91 99999 88888",
        otp: "123456",
        otpRequested: true
      })
    ).toEqual({
      errors: {},
      isValid: true,
      values: {
        mobileNumber: "+919999988888",
        otp: "123456"
      }
    });
  });

  test("validates delivery partner registration", () => {
    expect(
      validateRegistrationForm({
        email: "bad-email",
        fullName: "R",
        mobileNumber: "123",
        vehicleNumber: " dl 1 ab 1234 "
      })
    ).toMatchObject({
      isValid: false,
      errors: {
        email: "Enter a valid email address.",
        fullName: "Enter the driver's full name.",
        mobileNumber: "Enter a valid 10 digit Indian mobile number."
      },
      values: {
        vehicleNumber: "DL 1 AB 1234"
      }
    });
  });

  test("validates delivered COD payload requirements", () => {
    expect(
      validateDeliveryStatusForm({
        cashCollectedAmount: "100",
        expectedCodAmount: 1225,
        failureReason: "",
        isCod: true,
        proofSelected: true,
        receiverName: "Nisha Rao",
        status: "DELIVERED"
      })
    ).toMatchObject({
      isValid: false,
      errors: {
        cashCollectedAmount: "Collect at least INR 1,225 before marking delivered."
      }
    });
  });

  test("validates delivered non-COD and failed status payloads", () => {
    expect(
      validateDeliveryStatusForm({
        cashCollectedAmount: "",
        expectedCodAmount: 0,
        failureReason: "",
        isCod: false,
        proofSelected: false,
        receiverName: "",
        status: "DELIVERED"
      })
    ).toMatchObject({
      errors: {
        proof: "Attach proof of delivery.",
        receiverName: "Enter receiver name."
      },
      isValid: false
    });

    expect(
      validateDeliveryStatusForm({
        cashCollectedAmount: "",
        expectedCodAmount: 0,
        failureReason: " ",
        isCod: false,
        proofSelected: false,
        receiverName: "",
        status: "FAILED"
      })
    ).toMatchObject({
      errors: {
        failureReason: "Enter a failure reason."
      },
      isValid: false
    });
  });

  test("requires a reason before cancelling an assignment", () => {
    expect(
      validateDeliveryStatusForm({
        cashCollectedAmount: "",
        expectedCodAmount: 0,
        failureReason: " ",
        isCod: false,
        proofSelected: false,
        receiverName: "",
        status: "CANCELLED"
      })
    ).toMatchObject({
      errors: {
        failureReason: "Enter a cancellation reason."
      },
      isValid: false
    });
  });
});
