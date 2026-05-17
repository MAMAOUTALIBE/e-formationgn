"use client";

// Graphique mensuel revenu/commission/refund — pattern Stripe Dashboard MRR.
// 3 bars empilées (revenu brut / commission / refund) sur 12 mois.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MonthlyPoint {
  month: string;
  grossCents: number;
  platformFeeCents: number;
  refundsCents: number;
  ordersCount: number;
}

interface MonthlyFinanceChartProps {
  data: MonthlyPoint[];
}

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" })
    .format(new Date(y, m - 1, 1));
}

export function MonthlyFinanceChart({ data }: MonthlyFinanceChartProps) {
  const enriched = data.map((p) => ({
    label: formatMonth(p.month),
    Revenu: p.grossCents / 100,
    Commission: p.platformFeeCents / 100,
    Remboursé: p.refundsCents / 100,
    ordersCount: p.ordersCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={enriched} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k €`}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(0,0,0,0.1)",
          }}
          formatter={(value, name) => {
            const v = typeof value === "number" ? value : Number(value);
            return [`${v.toFixed(2)} €`, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar dataKey="Revenu" stackId="a" fill="#10B981" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Commission" stackId="b" fill="#1E3A8A" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Remboursé" stackId="c" fill="#EF4444" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
