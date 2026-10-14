import { describe, expect, it } from "vitest";
import { checkIdToken, GoogleSignInError } from "./google";

const now = Date.UTC(2026, 9, 14);
const expect_ = { clientId: "client-1", nonce: "n-1", now };
const token = (claims: Record<string, unknown>) =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");
const good = {
  iss: "https://accounts.google.com",
  aud: "client-1",
  exp: now / 1000 + 600,
  nonce: "n-1",
  sub: "1234567890",
  email: "Ana@Example.com",
  email_verified: true,
  name: "Ana",
};

describe("checkIdToken", () => {
  it("returns the profile from a valid token, with the email lower-cased", () => {
    expect(checkIdToken(token(good), expect_)).toEqual({ sub: "1234567890", email: "ana@example.com", name: "Ana" });
    expect(checkIdToken(token({ ...good, iss: "accounts.google.com", aud: ["client-1"] }), expect_).sub).toBe("1234567890");
  });

  it("falls back to the email's name part when Google gives no name", () => {
    expect(checkIdToken(token({ ...good, name: undefined }), expect_).name).toBe("ana");
  });

  it.each([
    ["another issuer", { iss: "https://evil.example" }],
    ["another app", { aud: "client-2" }],
    ["an expired token", { exp: now / 1000 - 1 }],
    ["another sign-in attempt", { nonce: "n-2" }],
    ["no account id", { sub: "" }],
    ["an unverified email", { email_verified: false }],
    ["a string 'true' email_verified", { email_verified: "true" }],
    ["no email", { email: undefined }],
  ])("refuses %s", (_, change) => {
    expect(() => checkIdToken(token({ ...good, ...change }), expect_)).toThrow(GoogleSignInError);
  });

  it("refuses missing or malformed tokens, and an empty client id", () => {
    expect(() => checkIdToken(undefined, expect_)).toThrow(GoogleSignInError);
    expect(() => checkIdToken("a.b", expect_)).toThrow(GoogleSignInError);
    expect(() => checkIdToken("a.%%%.c", expect_)).toThrow(GoogleSignInError);
    expect(() => checkIdToken(token({ ...good, aud: "" }), { ...expect_, clientId: "" })).toThrow(GoogleSignInError);
  });
});
