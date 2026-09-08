import { NewRoundForm } from "@/components/new-round-form";

export default function NewRoundPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-heading text-2xl">Nueva ronda</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Prepárate. En un momento estarás en el primer tee.
      </p>
      <div className="mt-6">
        <NewRoundForm />
      </div>
    </div>
  );
}
