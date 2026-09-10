"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** "¿Quieres revisar tu vuelta?" — el análisis de Mind se revela con un toque, no de golpe. */
export function MindInsightReveal({ insight, t }: { insight: string; t: Dictionary["summary"] }) {
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
