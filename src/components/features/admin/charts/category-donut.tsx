"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Slice {
  categoryName: string;
  revenueCents: number;
}

const COLORS = [
  "#1E3A8A", // brand-primary
  "#7c3aed", // brand-violet-deep
  "#0EA5E9", // brand-secondary
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function CategoryDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((sum, s) => sum + s.revenueCents, 0);
  if (total === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Aucune vente sur la période.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="revenueCents"
          nameKey="categoryName"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={((value: unknown) =>
            `${(Number(value) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} (toutes devises confondues)`) as never}
          contentStyle={{
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
