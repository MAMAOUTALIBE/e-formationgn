import { timingSafeEqual } from "node:crypto";

export function isCronBearerAuthorized(
  authorizationHeader: string | null,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret || !authorizationHeader) return false;
  const expected = Buffer.from(`Bearer ${expectedSecret}`, "utf8");
  const received = Buffer.from(authorizationHeader, "utf8");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
