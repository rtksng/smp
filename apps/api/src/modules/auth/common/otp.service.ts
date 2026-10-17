import { randomInt, timingSafeEqual } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthAudience } from "@surgical/types";
import { ApiQueueService } from "../../../queues/api-queue.service";
import { RedisCacheService } from "./redis-cache.service";

export enum OtpPurpose {
  Customer = "customer",
  DeliveryPartner = "delivery_partner"
}

export type OtpRequestResult = {
  devOtp?: string;
  expiresInSeconds: number;
  mobileNumber: string;
  resendAfterSeconds: number;
};

export type OtpCache = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

export type OtpServiceOptions = {
  cooldownSeconds: number;
  // Fixed code for demo numbers. When set, demo numbers log in with it and the
  // code is never returned in responses or sent to the phone.
  demoCode?: string;
  demoCustomerMobileNumbers?: string[];
  demoDeliveryMobileNumbers?: string[];
  exposeOtpInResponse?: boolean;
  generator: () => string;
  maxVerifyAttempts?: number;
  otpTtlSeconds: number;
  rateLimit: number;
  rateWindowSeconds: number;
};

function isOtpOptions(value: ConfigService | OtpServiceOptions | undefined) {
  return Boolean(value && "otpTtlSeconds" in value);
}

function defaultOtpGenerator() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeMobileNumber(mobileNumber: string) {
  return mobileNumber.trim();
}

function otpKey(purpose: OtpPurpose, mobileNumber: string) {
  return `auth:otp:${purpose}:${mobileNumber}:code`;
}

function cooldownKey(purpose: OtpPurpose, mobileNumber: string) {
  return `auth:otp:${purpose}:${mobileNumber}:cooldown`;
}

function rateKey(purpose: OtpPurpose, mobileNumber: string) {
  return `auth:otp:${purpose}:${mobileNumber}:rate`;
}

function attemptsKey(purpose: OtpPurpose, mobileNumber: string) {
  return `auth:otp:${purpose}:${mobileNumber}:attempts`;
}

const DEFAULT_MAX_VERIFY_ATTEMPTS = 5;

function safeOtpCompare(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function toOtpAudience(purpose: OtpPurpose): Exclude<AuthAudience, "admin"> {
  return purpose === OtpPurpose.Customer ? "customer" : "delivery_partner";
}

function throwTooManyRequests(message: string): never {
  throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly options: OtpServiceOptions;

  constructor(
    @Inject(RedisCacheService) private readonly cache: OtpCache,
    @Optional()
    @Inject(ConfigService)
    configOrOptions?: ConfigService | OtpServiceOptions,
    @Optional()
    @Inject(ApiQueueService)
    private readonly queueService?: ApiQueueService
  ) {
    if (isOtpOptions(configOrOptions)) {
      this.options = configOrOptions as OtpServiceOptions;
      return;
    }

    const configService = configOrOptions as ConfigService | undefined;
    this.options = {
      cooldownSeconds:
        configService?.get<number>("otpResendCooldownSeconds") ?? 60,
      demoCode: configService?.get<string>("otpDemoCode"),
      demoCustomerMobileNumbers:
        configService?.get<string[]>("otpDemoCustomerMobileNumbers") ?? [],
      demoDeliveryMobileNumbers:
        configService?.get<string[]>("otpDemoDeliveryMobileNumbers") ?? [],
      exposeOtpInResponse:
        configService?.get<boolean>("otpExposeInResponse") ??
        (process.env.NODE_ENV !== "production"),
      generator: defaultOtpGenerator,
      maxVerifyAttempts:
        configService?.get<number>("otpMaxVerifyAttempts") ??
        DEFAULT_MAX_VERIFY_ATTEMPTS,
      otpTtlSeconds: configService?.get<number>("otpTtlSeconds") ?? 300,
      rateLimit: configService?.get<number>("otpRateLimit") ?? 5,
      rateWindowSeconds:
        configService?.get<number>("otpRateWindowSeconds") ?? 3600
    };
  }

  async requestOtp(
    purpose: OtpPurpose,
    mobileNumber: string
  ): Promise<OtpRequestResult> {
    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
    const requestCount = await this.cache.increment(
      rateKey(purpose, normalizedMobileNumber),
      this.options.rateWindowSeconds
    );

    if (requestCount > this.options.rateLimit) {
      throwTooManyRequests("Too many OTP requests. Try again later.");
    }

    if (
      this.options.cooldownSeconds > 0 &&
      (await this.cache.get(cooldownKey(purpose, normalizedMobileNumber)))
    ) {
      throwTooManyRequests("Please wait before requesting another OTP.");
    }

    const isDemoNumber = this.isDemoNumber(purpose, normalizedMobileNumber);
    const useDemoCode = isDemoNumber && Boolean(this.options.demoCode);
    const otp = useDemoCode
      ? (this.options.demoCode as string)
      : this.options.generator();
    await this.cache.set(
      otpKey(purpose, normalizedMobileNumber),
      otp,
      this.options.otpTtlSeconds
    );
    await this.cache.delete(attemptsKey(purpose, normalizedMobileNumber));

    if (this.options.cooldownSeconds > 0) {
      await this.cache.set(
        cooldownKey(purpose, normalizedMobileNumber),
        "1",
        this.options.cooldownSeconds
      );
    }

    // Demo codes are shared out of band, so there is nothing to deliver.
    if (!useDemoCode) {
      await this.deliverOtp(purpose, normalizedMobileNumber, otp);
    }

    const shouldExposeOtp =
      !useDemoCode &&
      ((this.options.exposeOtpInResponse ??
        (process.env.NODE_ENV !== "production")) ||
        isDemoNumber);

    return {
      ...(shouldExposeOtp ? { devOtp: otp } : {}),
      expiresInSeconds: this.options.otpTtlSeconds,
      mobileNumber: normalizedMobileNumber,
      resendAfterSeconds: this.options.cooldownSeconds
    };
  }

  private async deliverOtp(
    purpose: OtpPurpose,
    mobileNumber: string,
    otp: string
  ) {
    if (this.queueService) {
      await this.queueService.enqueueOtp({
        mobileNumber,
        otp,
        purpose: toOtpAudience(purpose),
        requestedAt: new Date().toISOString(),
        version: 1
      });
      return;
    }

    this.logger.log(`Mock OTP for ${purpose} ${mobileNumber}: ${otp}`);
  }

  private isDemoNumber(purpose: OtpPurpose, mobileNumber: string) {
    const demoNumbers =
      purpose === OtpPurpose.Customer
        ? this.options.demoCustomerMobileNumbers
        : this.options.demoDeliveryMobileNumbers;

    return demoNumbers?.includes(mobileNumber) ?? false;
  }

  async verifyOtp(
    purpose: OtpPurpose,
    mobileNumber: string,
    otp: string
  ): Promise<boolean> {
    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
    const key = otpKey(purpose, normalizedMobileNumber);
    const attemptKey = attemptsKey(purpose, normalizedMobileNumber);
    const maxAttempts =
      this.options.maxVerifyAttempts ?? DEFAULT_MAX_VERIFY_ATTEMPTS;
    // Count the attempt before comparing so concurrent guesses cannot get
    // more than maxAttempts comparisons against one code.
    const attempt = await this.cache.increment(
      attemptKey,
      this.options.otpTtlSeconds
    );

    if (attempt > maxAttempts) {
      await this.cache.delete(key);
      throwTooManyRequests(
        "Too many incorrect OTP attempts. Request a new OTP."
      );
    }

    const storedOtp = await this.cache.get(key);

    if (storedOtp && safeOtpCompare(storedOtp, otp)) {
      await this.cache.delete(key);
      await this.cache.delete(attemptKey);
      return true;
    }

    if (storedOtp && attempt >= maxAttempts) {
      await this.cache.delete(key);
    }

    return false;
  }
}
