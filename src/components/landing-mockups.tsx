import { ChevronLeft, Minus, Plus, Trophy, Users } from "lucide-react";

/**
 * Representaciones ilustrativas de la propia interfaz (no interactivas) —
 * capturas de pantalla "falsas" con el mismo look real de la app (misma
 * paleta, mismos componentes), en vez de fotografía, para el hero y la
 * sección de pasos de la landing.
 */

function DemoTag() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-muted-foreground uppercase">
      Demo
    </span>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-[2.2rem] border-4 border-neutral-900 bg-neutral-900 p-1.5 shadow-xl">
      <div className="flex flex-col overflow-hidden rounded-[1.7rem] bg-background">
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
          <span className="text-[10px] font-medium text-muted-foreground">9:41</span>
          <div className="h-4 w-16 rounded-full bg-neutral-900" />
          <span className="text-[10px] text-muted-foreground">●●●</span>
        </div>
        <div className="flex flex-col gap-4 px-4 pt-1 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function HomeMockup() {
  return (
    <PhoneFrame>
      <div>
        <p className="font-heading text-lg font-semibold">Hola, Antonio</p>
        <p className="text-xs text-muted-foreground">¿Listo para tu próxima vuelta?</p>
      </div>
      <div className="rounded-2xl bg-secondary p-3.5">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">Son Muntaner</p>
          <DemoTag />
        </div>
        <p className="text-xs text-muted-foreground">Palma, Mallorca</p>
        <p className="mt-1 text-xs text-muted-foreground">18 hoyos · Par 72</p>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        {[
          { label: "Invitar jugadores", sub: "Añade a tus compañeros" },
          { label: "Modo de juego", sub: "Stroke Play" },
          { label: "Apuesta (opcional)", sub: "El perdedor invita a comer" },
        ].map((row) => (
          <div key={row.label} className="px-3.5 py-2.5">
            <p className="text-xs font-medium">{row.label}</p>
            <p className="text-[11px] text-muted-foreground">{row.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        Comenzar partida
      </div>
    </PhoneFrame>
  );
}

export function LobbyMockup() {
  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ChevronLeft className="size-3.5" />
        Crear partida
      </div>
      <div className="rounded-2xl bg-secondary p-3.5">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">Son Muntaner</p>
          <DemoTag />
        </div>
        <p className="text-xs text-muted-foreground">Palma, Mallorca</p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Jugadores</p>
        <div className="flex -space-x-2">
          {["A", "J", "P", "M"].map((initial) => (
            <span
              key={initial}
              className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-accent text-[10px] font-medium text-accent-foreground"
            >
              {initial}
            </span>
          ))}
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-border text-[10px] text-muted-foreground">
            +
          </span>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <Users className="size-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium">Modo de juego</p>
            <p className="text-[11px] text-muted-foreground">2 vs 2</p>
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-xs font-medium">Apuesta (opcional)</p>
          <p className="text-[11px] text-muted-foreground">El perdedor invita a una cerveza 🍺</p>
        </div>
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        Comenzar partida
      </div>
    </PhoneFrame>
  );
}

export function ScorecardMockup({ holeNumber = 7 }: { holeNumber?: number }) {
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <ChevronLeft className="size-3.5" />
        Salir
      </div>
      <div className="text-center">
        <p className="font-heading text-2xl tracking-tight">
          Hoyo {holeNumber} / 18
        </p>
        <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          Par 4 · Son Muntaner <DemoTag />
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { name: "Antonio", strokes: 5 },
          { name: "Juan", strokes: 4 },
          { name: "Pablo", strokes: 5 },
          { name: "Miguel", strokes: 6 },
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

export function MindAnalysisMockup() {
  return (
    <PhoneFrame>
      <p className="font-heading text-base font-semibold">Análisis de tu vuelta</p>
      <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 text-xs text-secondary-foreground">
        He revisado tu vuelta, Antonio. Entre los hoyos 11 y 14 perdiste 5 golpes. La próxima vez, un respiro antes de cada tee ahí.
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          { label: "Resultado", value: "87" },
          { label: "Par", value: "4" },
          { label: "Bogeys", value: "8" },
          { label: "Birdies", value: "3" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border py-2">
            <p className="font-heading text-sm font-semibold">{stat.value}</p>
            <p className="text-[9px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-accent p-3">
        <p className="text-[10px] font-medium text-accent-foreground">Tu principal aprendizaje</p>
        <p className="mt-1 text-xs text-accent-foreground">
          Después de un error, tu reacción influye en los siguientes hoyos. Vamos a trabajarlo en la próxima vuelta.
        </p>
      </div>
    </PhoneFrame>
  );
}

export function ResultMockup() {
  return (
    <PhoneFrame>
      <p className="text-center font-heading text-base font-semibold">¡Vuelta terminada!</p>
      <p className="-mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        Son Muntaner · 18 hoyos · Par 72 <DemoTag />
      </p>
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
      <div className="rounded-xl bg-secondary py-2 text-center text-xs font-medium text-secondary-foreground">
        😅 El perdedor invita a comer
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        Ver análisis con Mind
      </div>
      <p className="text-center text-xs font-medium text-muted-foreground">¿Revancha?</p>
    </PhoneFrame>
  );
}

export function RivalryCard() {
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-center text-xs font-medium text-muted-foreground">Antonio vs Juan</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-center">
          <p className="font-heading text-2xl font-semibold">5</p>
          <p className="text-[11px] text-muted-foreground">Antonio</p>
        </div>
        <div className="text-center text-muted-foreground">
          <p className="font-heading text-lg">8</p>
          <p className="text-[10px]">partidas</p>
        </div>
        <div className="text-center">
          <p className="font-heading text-2xl font-semibold">3</p>
          <p className="text-[11px] text-muted-foreground">Juan</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-primary py-2 text-center text-xs font-medium text-primary-foreground">¿Revancha?</div>
    </div>
  );
}
