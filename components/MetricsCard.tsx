import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: number;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function MetricsCard({
  title,
  value,
  description,
  variant = "default",
}: MetricsCardProps) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-red-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variantStyles[variant]}`}>
          {formatCurrency(value)}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

