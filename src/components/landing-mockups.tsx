import { Minus, Plus, Trophy } from "lucide-react";

/**
 * Representaciones ilustrativas de la propia interfaz (no interactivas) —
 * el brief pide priorizar layout/UI sobre fotografía por ahora, así que
 * el hero y las secciones de storytelling se apoyan en esto en vez de
 * imágenes.
 */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[2rem] border border-border bg-card p-2 shadow-lg">
      <div className="flex flex-col gap-4 rounded-[1.5rem] bg-background px-5 py-8">{children}</div>
    </div>
  );
}

export function ScorecardMockup() {
  return (
    <PhoneFrame>
      <div className="text-center">
        <p className="font-heading text-2xl tracking-tight">Hoyo 7</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Par 4</p>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { name: "Antonio", strokes: 5 },
          { name: "Juan", strokes: 4 },
        ].map((p) => (
          <div key={p.name} className="flex items-center justify-between">
            <span className="text-sm font-medium">{p.name}</span>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border border-border">
                <Minus className="size-3" />
              </span>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-heading text-primary-foreground">
                {p.strokes}
              </span>
              <span className="flex size-6 items-center justify-center rounded-full border border-border">
                <Plus className="size-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        Guardar hoyo
      </div>
    </PhoneFrame>
  );
}

export function MindChatMockup() {
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-2.5">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          He empezado muy bien, pero se me ha ido entre el 11 y el 14.
        </div>
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-secondary-foreground">
          Entre esos hoyos perdiste 5 golpes. La próxima vez, un respiro antes de cada tee ahí.
        </div>
      </div>
    </PhoneFrame>
  );
}

export function ResultMockup() {
  return (
    <PhoneFrame>
      <div className="flex flex-col items-center gap-1 text-center">
        <Trophy className="size-6 text-primary" />
        <p className="font-heading text-xl">Antonio</p>
        <p className="text-sm text-muted-foreground">87 golpes</p>
      </div>
      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Juan</span>
          <span>89</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Pablo</span>
          <span>92</span>
        </div>
      </div>
    </PhoneFrame>
  );
}
