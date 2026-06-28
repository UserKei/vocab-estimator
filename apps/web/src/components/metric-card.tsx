export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-20 flex-col justify-center gap-1 rounded-md border bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="text-2xl leading-none">{value}</strong>
    </div>
  )
}
