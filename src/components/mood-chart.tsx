"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MoodPoint } from "@/lib/mood";

const MOOD_TICKS: Record<number, string> = {
  [-2]: "😤",
  [-1]: "😬",
  [0]: "",
  [1]: "🙂",
  [2]: "😎",
};

export function MoodChart({ data }: { data: MoodPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No se registraron check-ins de ánimo en esta ronda.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[-2, 2]}
            ticks={[-2, -1, 0, 1, 2]}
            tickFormatter={(v) => MOOD_TICKS[v] ?? ""}
            width={28}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--popover-foreground)" }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "var(--chart-2)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
