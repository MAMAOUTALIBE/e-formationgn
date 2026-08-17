import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Search } from "lucide-react";

export const metadata: Metadata = { title: "Communication — Administration" };

export default function AdminMarketingPage() {
  const tools = [
    {
      href: "/admin/marketing/campagnes-email",
      label: "Campagnes email",
      description: "Informer les apprenants et les sociétés.",
      icon: Mail,
    },
    {
      href: "/admin/marketing/seo",
      label: "Référencement",
      description: "Optimiser la visibilité des contenus pédagogiques.",
      icon: Search,
    },
  ];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Communication</h1>
        <p className="text-sm text-muted-foreground">
          Communication pédagogique et visibilité des formations.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        {tools.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-border bg-card p-5 hover:bg-muted/40"
          >
            <Icon className="h-5 w-5 text-[color:var(--brand-primary)]" />
            <h2 className="mt-3 font-semibold">{label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
