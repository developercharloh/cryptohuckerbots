const KNOWN_FAKE_NUMBERS = new Set([
  "078051120",
  "219099999",
  "457555462",
  "123456789",
  "111111111",
  "222222222",
  "333333333",
  "444444444",
  "555555555",
  "666666666",
  "777777777",
  "888888888",
  "999999999",
  "000000000",
  "012345678",
  "987654321",
]);

function isAllSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function isSequential(digits: string): boolean {
  if (digits.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    const prev = Number(digits[i - 1]);
    const curr = Number(digits[i]);
    if (curr !== prev + 1) ascending = false;
    if (curr !== prev - 1) descending = false;
  }
  return ascending || descending;
}

function isRepeatingPattern(digits: string): boolean {
  for (const chunkSize of [1, 2, 3]) {
    if (digits.length < chunkSize * 3) continue;
    const chunk = digits.slice(0, chunkSize);
    const repeated = chunk.repeat(Math.ceil(digits.length / chunkSize)).slice(0, digits.length);
    if (repeated === digits) return true;
  }
  return false;
}

export interface IdCheckResult {
  suspicious: boolean;
  hardReject: boolean;
  reasons: string[];
}

/**
 * Heuristic fake-ID / fake-SSN detector. Not a substitute for real verification —
 * it only catches obviously fabricated numbers (all-zeros, sequential digits,
 * well-known placeholder SSNs, and structurally invalid US SSNs), plus flags
 * unusual lengths for admin review. Real KYC decisions remain manual.
 */
export function detectFakeId(rawId: string, country?: string | null): IdCheckResult {
  const reasons: string[] = [];
  let hardReject = false;

  const digits = (rawId ?? "").replace(/\D/g, "");

  if (!digits) {
    return { suspicious: true, hardReject: true, reasons: ["No numeric digits found in ID number"] };
  }

  if (isAllSameDigit(digits)) {
    reasons.push("All digits are identical");
    hardReject = true;
  }

  if (isSequential(digits)) {
    reasons.push("Digits form a simple sequential pattern");
    hardReject = true;
  }

  if (isRepeatingPattern(digits) && !isAllSameDigit(digits)) {
    reasons.push("Digits repeat a short pattern");
    hardReject = true;
  }

  if (KNOWN_FAKE_NUMBERS.has(digits)) {
    reasons.push("Matches a known fake/placeholder number");
    hardReject = true;
  }

  const isKenya = !!country && /kenya/i.test(country);
  const isUS = !!country && /united states/i.test(country);

  if (isUS && digits.length === 9) {
    const area = digits.slice(0, 3);
    const group = digits.slice(3, 5);
    const serial = digits.slice(5);
    if (area === "000" || area === "666" || Number(area) >= 900) {
      reasons.push("Invalid SSN area number");
      hardReject = true;
    }
    if (group === "00") {
      reasons.push("Invalid SSN group number");
      hardReject = true;
    }
    if (serial === "0000") {
      reasons.push("Invalid SSN serial number");
      hardReject = true;
    }
  } else if (isUS && digits.length !== 9) {
    reasons.push("US SSN should be 9 digits");
  }

  if (isKenya && (digits.length < 6 || digits.length > 8)) {
    reasons.push("Kenyan national ID numbers are usually 6-8 digits");
  }

  return { suspicious: reasons.length > 0, hardReject, reasons };
}
