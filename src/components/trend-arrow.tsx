export function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  return <span className="font-medium text-foreground">{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>;
}
