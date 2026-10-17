import { applyDecorators } from "@nestjs/common";
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationOptions
} from "class-validator";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_RULES =
  "Password must be at least 12 characters, include letters and numbers, and not repeat a few characters.";

// Applies when an admin password is set or changed. Existing shorter
// passwords still log in until they are next changed.
export function IsAdminPassword() {
  return applyDecorators(
    IsString(),
    MinLength(ADMIN_PASSWORD_MIN_LENGTH, { message: ADMIN_PASSWORD_RULES }),
    MaxLength(128),
    Matches(/[A-Za-z]/, { message: ADMIN_PASSWORD_RULES }),
    Matches(/\d/, { message: ADMIN_PASSWORD_RULES }),
    HasDistinctCharacters(6, { message: ADMIN_PASSWORD_RULES })
  );
}

// Rejects passwords like "aaaaaaaaaaa1" that pass the length rule but are
// built from almost one character.
function HasDistinctCharacters(minimum: number, options?: ValidationOptions) {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: "hasDistinctCharacters",
      options,
      propertyName: String(propertyName),
      target: target.constructor,
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" && new Set(value).size >= minimum
      }
    });
  };
}
