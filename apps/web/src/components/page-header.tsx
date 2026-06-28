import { Badge } from "@/components/ui/badge"

export function PageHeader({
  title,
  description,
  badge,
}: {
  title: string
  description: string
  badge?: string
}) {
  return (
    <section className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {badge ? <Badge variant="outline">{badge}</Badge> : null}
    </section>
  )
}
