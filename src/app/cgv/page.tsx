import type { Metadata } from "next";

import { CmsPageView } from "@/components/features/cms/cms-page";
import { getCmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("cgv");
  return { title: page.title, alternates: { canonical: "/cgv" } };
}

export default async function CGVPage() {
  const page = await getCmsPage("cgv");
  return <CmsPageView title={page.title} body={page.body} />;
}
