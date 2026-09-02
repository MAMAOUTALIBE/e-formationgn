import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { resolvePersistentMediaReferences, type PersistentMediaBatchReader } from "@/lib/domain/persistent-media-reference";
import { prisma } from "@/lib/prisma";

const textFilters = (candidates: string[]) => candidates.map((value) => ({ contains: value }));
const present = (values: Array<string | null | undefined>) => values.filter((value): value is string => Boolean(value));

/** Registre central et batché des champs qui peuvent servir ou afficher un média. */
const prismaMediaReader: PersistentMediaBatchReader = {
  async scalarUrls(candidates) {
    const [users, courses, lessons, resources, orders, certificates, banners, notifications] = await Promise.all([
      prisma.user.findMany({ where: { OR: [
        { image: { in: candidates } }, { websiteUrl: { in: candidates } }, { linkedinUrl: { in: candidates } },
        { facebookUrl: { in: candidates } }, { twitterUrl: { in: candidates } }, { youtubeUrl: { in: candidates } },
      ] }, select: { image: true, websiteUrl: true, linkedinUrl: true, facebookUrl: true, twitterUrl: true, youtubeUrl: true } }),
      prisma.course.findMany({ where: { OR: [
        { thumbnailUrl: { in: candidates } },
        { heroBackgroundUrl: { in: candidates } },
        { promoVideoUrl: { in: candidates } },
      ] }, select: { thumbnailUrl: true, heroBackgroundUrl: true, promoVideoUrl: true } }),
      prisma.lesson.findMany({ where: { OR: [{ externalVideoUrl: { in: candidates } }, { resourceUrl: { in: candidates } }] }, select: { externalVideoUrl: true, resourceUrl: true } }),
      prisma.lessonResource.findMany({ where: { url: { in: candidates } }, select: { url: true } }),
      prisma.order.findMany({ where: { stripeReceiptUrl: { in: candidates } }, select: { stripeReceiptUrl: true } }),
      prisma.certificate.findMany({ where: { pdfUrl: { in: candidates } }, select: { pdfUrl: true } }),
      prisma.sitewideBanner.findMany({ where: { ctaUrl: { in: candidates } }, select: { ctaUrl: true } }),
      prisma.notification.findMany({ where: { url: { in: candidates } }, select: { url: true } }),
    ]);
    return present([
      ...users.flatMap(Object.values), ...courses.flatMap(Object.values), ...lessons.flatMap(Object.values),
      ...resources.map((item) => item.url), ...orders.map((item) => item.stripeReceiptUrl),
      ...certificates.map((item) => item.pdfUrl), ...banners.map((item) => item.ctaUrl),
      ...notifications.map((item) => item.url),
    ]);
  },
  async embeddedTexts(candidates) {
    const filters = textFilters(candidates);
    const [cms, emails, tickets, notifications] = await Promise.all([
      prisma.cmsPage.findMany({ where: { OR: filters.map((body) => ({ body })) }, select: { body: true } }),
      prisma.emailTemplate.findMany({ where: { OR: [
        ...filters.map((bodyHtml) => ({ bodyHtml })), ...filters.map((bodyText) => ({ bodyText })),
      ] }, select: { bodyHtml: true, bodyText: true } }),
      prisma.ticketMessage.findMany({ where: { OR: filters.map((body) => ({ body })) }, select: { body: true } }),
      prisma.notification.findMany({ where: { OR: filters.map((body) => ({ body })) }, select: { body: true } }),
    ]);
    return [
      ...cms.map((item) => item.body), ...emails.flatMap((item) => [item.bodyHtml, item.bodyText]),
      ...tickets.map((item) => item.body), ...notifications.map((item) => item.body),
    ];
  },
  async hasUnfilterableStructuredMedia() {
    const [emailVariables, attachments] = await Promise.all([
      prisma.emailTemplate.count({ where: { variables: { not: Prisma.DbNull } } }),
      prisma.ticketMessage.count({ where: { attachments: { not: Prisma.DbNull } } }),
    ]);
    return emailVariables > 0 || attachments > 0;
  },
};

export function findPersistedMediaUrlReferences(urls: string[]): Promise<Set<string>> {
  return resolvePersistentMediaReferences(urls, prismaMediaReader);
}
