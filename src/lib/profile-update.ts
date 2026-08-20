import type { Prisma, UserRole } from "@/generated/prisma/client";
import type {
  UpdateProfileInput,
  UpdateStudentPublicProfileInput,
} from "@/lib/validators/auth";

function emptyToNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

type PublicProfileInput = UpdateStudentPublicProfileInput;

export function canUpdateProfileIdentity(role: UserRole): boolean {
  return role !== "STUDENT";
}

export function buildPublicProfileUpdate(
  data: PublicProfileInput,
): Prisma.UserUpdateInput {
  return {
    headline: emptyToNull(data.headline),
    bio: emptyToNull(data.bio),
    websiteUrl: emptyToNull(data.websiteUrl),
    linkedinUrl: emptyToNull(data.linkedinUrl),
    facebookUrl: emptyToNull(data.facebookUrl),
    twitterUrl: emptyToNull(data.twitterUrl),
    youtubeUrl: emptyToNull(data.youtubeUrl),
  };
}

export function buildProfileUpdate(
  role: UserRole,
  data: UpdateProfileInput | PublicProfileInput,
): Prisma.UserUpdateInput {
  const publicData = buildPublicProfileUpdate(data);
  if (!canUpdateProfileIdentity(role)) return publicData;

  const identity = data as UpdateProfileInput;
  return {
    ...publicData,
    firstName: identity.firstName,
    lastName: identity.lastName,
    name: `${identity.firstName} ${identity.lastName}`,
  };
}
