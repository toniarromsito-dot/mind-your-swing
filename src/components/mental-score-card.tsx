import { Card, CardContent } from "@/components/ui/card";
import { MentalScoreRing } from "@/components/mental-score-ring";
import type { MentalScore, MentalTrend } from "@/lib/mood";

function TrendGlyph({ trend }: { trend: MentalTrend }) {
  return <span className="text-xs">{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>;
}

export function MentalScoreCard({
  score,
  labels,
}: {
  score: MentalScore;
  labels: { confidence: string; focus: string; pressure: string };
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="flex items-center gap-5 py-5">
        <MentalScoreRing score={score.score} />
        <div className="flex flex-1 flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{labels.confidence}</span>
            <TrendGlyph trend={score.confidence} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{labels.focus}</span>
            <TrendGlyph trend={score.focus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{labels.pressure}</span>
            <TrendGlyph trend={score.pressure} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
