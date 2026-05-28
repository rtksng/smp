import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcrypt";

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(configService: ConfigService) {
    this.saltRounds = configService.get<number>("bcryptSaltRounds") ?? 12;
  }

  async hash(password: string) {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verify(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }
}
