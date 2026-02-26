import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
