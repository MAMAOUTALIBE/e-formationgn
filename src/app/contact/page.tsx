import type { Metadata } from "next";

import { CmsPageView } from "@/components/features/cms/cms-page";
import { getCmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("contact");
  return { title: page.title, alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const page = await getCmsPage("contact");
  return <CmsPageView title={page.title} body={page.body} />;
}
