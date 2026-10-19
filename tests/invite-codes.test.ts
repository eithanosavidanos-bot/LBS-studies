import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, decryptCode, encryptCode, generateCode, hashCode, isWellFormed, normalizeCode } from "@/lib/invite-codes";

const SECRET = "test-secret";

describe("invite codes", () => {
  it("generates PREFIX-XXXX-XXXX from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode("PMB");
      expect(code).toMatch(/^PMB-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect([...code.slice(4).replace("-", "")].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
      expect(code).not.toMatch(/[IO01]/);
      expect(isWellFormed(code, "PMB")).toBe(true);
    }
  });

  it("normalizes case and separators", () => {
    expect(normalizeCode(" pmb 7kq2–xm4d ")).toBe("PMB7KQ2XM4D");
    expect(hashCode("pmb-7kq2-xm4d", SECRET)).toBe(hashCode("PMB 7KQ2 XM4D", SECRET));
  });

  it("rejects malformed codes", () => {
    expect(isWellFormed("PMB-7KQ2-XM4", "PMB")).toBe(false);
    expect(isWellFormed("XYZ-7KQ2-XM4D", "PMB")).toBe(false);
    expect(isWellFormed("PMB-7KQ2-XM40", "PMB")).toBe(false); // 0 is not in the alphabet
  });

  it("hashes with the secret", () => {
    const code = "PMB-7KQ2-XM4D";
    expect(hashCode(code, SECRET)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode(code, SECRET)).not.toBe(hashCode(code, "other-secret"));
  });

  it("encrypts so only the same secret can read the code back", () => {
    const blob = encryptCode("PMB-7KQ2-XM4D", SECRET);
    expect(blob).not.toContain("7KQ2");
    expect(decryptCode(blob, SECRET)).toBe("PMB-7KQ2-XM4D");
    expect(decryptCode(blob, "wrong")).toBeNull();
    expect(encryptCode("PMB-7KQ2-XM4D", SECRET)).not.toBe(blob); // random IV
  });
});
