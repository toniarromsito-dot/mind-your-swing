import { LogoMark } from "@/components/logo-mark";

export function LandingFooter({
  tagline,
  rights,
  links,
}: {
  tagline: string;
  rights: string;
  links: { href: string; label: string }[];
}) {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <LogoMark className="h-4 w-auto text-foreground" />
          <div>
            <p className="text-sm font-semibold">Mind Your Swing</p>
            <p className="text-xs text-muted-foreground">{tagline}</p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Mind Your Swing. {rights}</p>
      </div>
    </footer>
  );
}
