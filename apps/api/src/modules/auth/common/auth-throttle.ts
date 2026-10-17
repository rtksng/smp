// Per-IP limits for credential endpoints, applied with
// @Throttle({ default: AUTH_THROTTLE_LIMITS.<route> }). They sit on top of the
// per-number OTP limits in OtpService. Many mobile users share one public IP
// through carrier NAT, so the limits stay well above what one person needs.
export const AUTH_THROTTLE_LIMITS = {
  login: { limit: 10, ttl: 60_000 },
  otpRequest: { limit: 10, ttl: 60_000 },
  otpVerify: { limit: 20, ttl: 60_000 },
  registration: { limit: 10, ttl: 60_000 }
} as const;
