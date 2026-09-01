import crypto from "node:crypto";
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 32 * 1024 * 1024;
const LEGACY_SALT = "vixus_salt_2024";

function deriveKey(
  password: string,
  salt: string,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keyLength,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: MAX_MEMORY,
      },
      (error, derived) => error ? reject(error) : resolve(derived),
    );
  });
}

export type PasswordVerification = {
  valid: boolean;
  needsRehash: boolean;
};

function legacyHashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = await deriveKey(password, salt, KEY_LENGTH);

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt,
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<PasswordVerification> {
  if (!encodedHash.startsWith("scrypt$")) {
    const expected = Buffer.from(legacyHashPassword(password), "hex");
    const actual = Buffer.from(encodedHash, "hex");
    const valid =
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual);
    return { valid, needsRehash: valid };
  }

  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return { valid: false, needsRehash: false };
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![n, r, p].every(Number.isInteger) || n <= 1 || r <= 0 || p <= 0) {
    return { valid: false, needsRehash: false };
  }

  try {
    const expected = Buffer.from(parts[5], "base64url");
    const actual = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        parts[4],
        expected.length,
        { N: n, r, p, maxmem: MAX_MEMORY },
        (error, derived) => error ? reject(error) : resolve(derived),
      );
    });
    const valid =
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual);
    const needsRehash = valid && (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P);
    return { valid, needsRehash };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}