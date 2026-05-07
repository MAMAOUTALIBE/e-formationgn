import type { Metadata } from "next";

import { CmsPageView } from "@/components/features/cms/cms-page";
import { getCmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("confidentialite");
  return { title: page.title };
}

export default async function ConfidentialitePage() {
  const page = await getCmsPage("confidentialite");
  return <CmsPageView title={page.title} body={page.body} />;
}
