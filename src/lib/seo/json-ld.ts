// Constructeurs de structures schema.org pour les rich snippets Google.
// Voir https://schema.org/Course et https://developers.google.com/search/docs/appearance/structured-data/course-info

import type { PublicCourseDetail } from "@/server/queries/courses";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gandal.org";
const SITE_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Gandal";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Construit un BreadcrumbList schema.org à partir de la liste affichée
 * dans le composant Breadcrumbs. L'item courant (sans `href`) est inclus
 * comme dernière position, ce qui correspond aux recommandations Google.
 */
export function buildBreadcrumbListJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

/**
 * Construit un Course schema.org avec offers (prix actuels par devise),
 * aggregateRating (si avis), provider, hasCourseInstance.
 */
export function buildCourseJsonLd(course: PublicCourseDetail) {
  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");

  const offers = buildCourseOffers(course);

  const aggregateRating =
    course.totalRatings > 0
      ? {
          "@type": "AggregateRating" as const,
          ratingValue: Number(course.averageRating.toFixed(1)),
          ratingCount: course.totalRatings,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined;

  const hours = Math.max(1, Math.round(course.durationSeconds / 3600));

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description.slice(0, 300),
    url: absoluteUrl(`/cours/${course.slug}`),
    inLanguage: course.language === "FR" ? "fr-FR" : course.language,
    image: course.thumbnailUrl ?? undefined,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      sameAs: APP_URL,
    },
    instructor: {
      "@type": "Person",
      name: instructorName,
      ...(course.instructor.image ? { image: course.instructor.image } : {}),
    },
    // Google demande au moins un CourseInstance avec courseMode + duration.
    hasCourseInstance: [
      {
        "@type": "CourseInstance",
        courseMode: "Online",
        courseWorkload: `PT${hours}H`,
      },
    ],
    offers,
    ...(aggregateRating ? { aggregateRating } : {}),
  };
}

function buildCourseOffers(course: PublicCourseDetail) {
  const now = Date.now();
  const isDiscountActive = (endsAt: Date | null | undefined) =>
    endsAt === null || endsAt === undefined || endsAt.getTime() > now;

  const offers: Array<{
    "@type": "Offer";
    price: string;
    priceCurrency: string;
    availability: string;
    url: string;
  }> = [];

  const add = (
    fullPrice: number,
    discount: number | null,
    currency: "EUR" | "USD" | "GNF" | "XOF",
  ) => {
    if (Number.isNaN(fullPrice)) return;
    const price =
      discount !== null && discount < fullPrice && isDiscountActive(course.discountEndsAt)
        ? discount
        : fullPrice;
    if (price <= 0) return;
    offers.push({
      "@type": "Offer",
      price: price.toFixed(currency === "GNF" || currency === "XOF" ? 0 : 2),
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/cours/${course.slug}`),
    });
  };

  add(Number(course.priceEUR), course.discountPriceEUR ? Number(course.discountPriceEUR) : null, "EUR");
  add(Number(course.priceUSD), course.discountPriceUSD ? Number(course.discountPriceUSD) : null, "USD");
  add(Number(course.priceGNF), course.discountPriceGNF ? Number(course.discountPriceGNF) : null, "GNF");
  add(Number(course.priceXOF), course.discountPriceXOF ? Number(course.discountPriceXOF) : null, "XOF");

  return offers.length === 0
    ? [
        {
          "@type": "Offer" as const,
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          url: absoluteUrl(`/cours/${course.slug}`),
        },
      ]
    : offers;
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${APP_URL.replace(/\/$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
