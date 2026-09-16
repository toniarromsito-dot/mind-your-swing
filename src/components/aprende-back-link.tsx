import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function AprendeBackLink({ label }: { label: string }) {
  return (
    <Link
      href="/aprende"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}
