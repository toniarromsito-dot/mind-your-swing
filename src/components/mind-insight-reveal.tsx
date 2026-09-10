"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Solo los 3 textos que este componente realmente usa — nunca el objeto
// Dictionary["summary"] completo: trae funciones (holeLabel, chartHole,
// chartCheckin) que un Server Component no puede pasar a un Client
// Component (rompía /resumen entero en cuanto la vuelta tenía insight).
type MindInsightRevealText = { reviewPrompt: string; reviewButton: string; fromCoach: string };

/** "¿Quieres revisar tu vuelta?" — el análisis de Mind se revela con un toque, no de golpe. */
export function MindInsightReveal({ insight, t }: { insight: string; t: MindInsightRevealText }) {
  const [shown, setShown] = useState(false);

  if (!shown) {
    return (
      <Card className="border-primary/30 bg-secondary/40">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-medium">{t.reviewPrompt}</p>
          <Button type="button" className="gap-2" onClick={() => setShown(true)}>
            <Brain className="size-4" />
            {t.reviewButton}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-secondary/40">
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t.fromCoach}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{insight}</p>
      </CardContent>
    </Card>
  );
}
