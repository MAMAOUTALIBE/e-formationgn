"use client";

// Courbes daily enrollment + revenue d'un cours sur les 30 derniers jours.
// 2 séries sur un même graphique : enrollments (gauche) + revenue (droite).

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  date: string;
  enrollments: number;
  revenueCents: number;
}

interface CourseInsightsChartProps {
  data: DataPoint[];
  currency?: string;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

export function CourseInsightsChart({
  data,
  currency = "EUR",
}: CourseInsightsChartProps) {
  const enriched = data.map((p) => ({
    ...p,
    revenueDecimal: p.revenueCents / 100,
    label: dateFormatter.format(new Date(p.date)),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={enriched} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradEnroll" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(0,0,0,0.1)",
          }}
          formatter={(value, name) => {
            const v = typeof value === "number" ? value : Number(value);
            if (name === "Revenu") {
              return [`${v.toFixed(2)} ${currency}`, name];
            }
            return [String(v), name];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="enrollments"
          name="Inscriptions"
          stroke="#1E3A8A"
          fill="url(#gradEnroll)"
          strokeWidth={2}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="revenueDecimal"
          name="Revenu"
          stroke="#10B981"
          fill="url(#gradRevenue)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
