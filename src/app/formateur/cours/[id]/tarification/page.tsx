import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CoursePricingForm } from "@/components/features/instructor/course-pricing-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInstructorCourse } from "@/server/queries/instructor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CoursePricingPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const course = await getInstructorCourse(
    id,
    session.user.id,
    session.user.role === "ADMIN",
  );
  if (!course) notFound();

  // Pour l'input datetime-local, format YYYY-MM-DDTHH:mm
  const discountEndsAt = course.discountEndsAt
    ? new Date(course.discountEndsAt).toISOString().slice(0, 16)
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarification</CardTitle>
      </CardHeader>
      <CardContent>
        <CoursePricingForm
          courseId={course.id}
          defaults={{
            priceEUR: Number(course.priceEUR),
            priceUSD: Number(course.priceUSD),
            priceGNF: Number(course.priceGNF),
            priceXOF: Number(course.priceXOF),
            discountPriceEUR:
              course.discountPriceEUR != null ? Number(course.discountPriceEUR) : null,
            discountPriceUSD:
              course.discountPriceUSD != null ? Number(course.discountPriceUSD) : null,
            discountPriceGNF:
              course.discountPriceGNF != null ? Number(course.discountPriceGNF) : null,
            discountPriceXOF:
              course.discountPriceXOF != null ? Number(course.discountPriceXOF) : null,
            discountEndsAt,
          }}
        />
      </CardContent>
    </Card>
  );
}
