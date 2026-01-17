import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, description, trend, className }: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-md bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
        {description && (
          <p className={cn("text-xs mt-1", 
            trend === "up" ? "text-green-500" : 
            trend === "down" ? "text-red-500" : "text-muted-foreground"
          )}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
