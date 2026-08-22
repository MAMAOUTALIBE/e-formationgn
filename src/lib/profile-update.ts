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

/**
 * Ce qu'il faut connaître d'un compte pour savoir s'il peut se renommer.
 *
 * Le rôle ne suffit pas. Un apprenant habilité formateur change de rôle, et
 * une règle qui ne lirait que le rôle lui rendrait à cet instant la main sur
 * le prénom et le nom que le centre avait saisis — ceux-là mêmes qui figurent
 * sur ses certificats. D'où le second critère, durable : `identityLockedAt`.
 */
export interface IdentitySubject {
  role: UserRole;
  identityLockedAt?: Date | null;
}

export function canUpdateProfileIdentity(subject: IdentitySubject): boolean {
  if (subject.identityLockedAt) return false;
  return subject.role !== "STUDENT";
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
  subject: IdentitySubject,
  data: UpdateProfileInput | PublicProfileInput,
): Prisma.UserUpdateInput {
  const publicData = buildPublicProfileUpdate(data);
  if (!canUpdateProfileIdentity(subject)) return publicData;

  const identity = data as UpdateProfileInput;
  return {
    ...publicData,
    firstName: identity.firstName,
    lastName: identity.lastName,
    name: `${identity.firstName} ${identity.lastName}`,
  };
}
