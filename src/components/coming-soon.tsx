export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-24 text-center">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
        {title}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <span className="mt-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
        Coming soon
      </span>
    </div>
  );
}
