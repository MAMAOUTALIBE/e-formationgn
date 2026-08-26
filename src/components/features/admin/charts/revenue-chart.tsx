"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenuePoint {
  date: string;
  EUR: number;
  USD: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueEur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="revenueUsd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => dateFormatter.format(new Date(v))}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${(v / 100).toFixed(0)}`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          formatter={((value: unknown, name: unknown) => [
            `${(Number(value) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${name}`,
            String(name),
          ]) as never}
          labelFormatter={(label) => dateFormatter.format(new Date(String(label)))}
          contentStyle={{
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="EUR"
          stroke="#1E3A8A"
          strokeWidth={2}
          fill="url(#revenueEur)"
        />
        <Area
          type="monotone"
          dataKey="USD"
          stroke="#0EA5E9"
          strokeWidth={2}
          fill="url(#revenueUsd)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
