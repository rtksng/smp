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
  demoCustomerMobileNumbers?: string[];
  demoDeliveryMobileNumbers?: string[];
  exposeOtpInResponse?: boolean;
  generator: () => string;
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
      demoCustomerMobileNumbers:
        configService?.get<string[]>("otpDemoCustomerMobileNumbers") ?? [],
      demoDeliveryMobileNumbers:
        configService?.get<string[]>("otpDemoDeliveryMobileNumbers") ?? [],
      exposeOtpInResponse:
        configService?.get<boolean>("otpExposeInResponse") ??
        (process.env.NODE_ENV !== "production"),
      generator: defaultOtpGenerator,
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

    const otp = this.options.generator();
    await this.cache.set(
      otpKey(purpose, normalizedMobileNumber),
      otp,
      this.options.otpTtlSeconds
    );

    if (this.options.cooldownSeconds > 0) {
      await this.cache.set(
        cooldownKey(purpose, normalizedMobileNumber),
        "1",
        this.options.cooldownSeconds
      );
    }

    if (this.queueService) {
      await this.queueService.enqueueOtp({
        mobileNumber: normalizedMobileNumber,
        otp,
        purpose: toOtpAudience(purpose),
        requestedAt: new Date().toISOString(),
        version: 1
      });
    } else {
      this.logger.log(
        `Mock OTP for ${purpose} ${normalizedMobileNumber}: ${otp}`
      );
    }

    const shouldExposeOtp =
      (this.options.exposeOtpInResponse ??
        (process.env.NODE_ENV !== "production")) ||
      (purpose === OtpPurpose.Customer &&
        this.options.demoCustomerMobileNumbers?.includes(
          normalizedMobileNumber
        )) ||
      (purpose === OtpPurpose.DeliveryPartner &&
        this.options.demoDeliveryMobileNumbers?.includes(
          normalizedMobileNumber
        ));

    return {
      ...(shouldExposeOtp ? { devOtp: otp } : {}),
      expiresInSeconds: this.options.otpTtlSeconds,
      mobileNumber: normalizedMobileNumber,
      resendAfterSeconds: this.options.cooldownSeconds
    };
  }

  async verifyOtp(
    purpose: OtpPurpose,
    mobileNumber: string,
    otp: string
  ): Promise<boolean> {
    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
    const key = otpKey(purpose, normalizedMobileNumber);
    const storedOtp = await this.cache.get(key);

    if (!storedOtp || !safeOtpCompare(storedOtp, otp)) {
      return false;
    }

    await this.cache.delete(key);
    return true;
  }
}
