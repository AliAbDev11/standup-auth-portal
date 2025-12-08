import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  percentage?: number;
  color: "blue" | "green" | "orange" | "red";
}

const StatCard = ({ icon, label, value, percentage, color }: StatCardProps) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            colorClasses[color]
          )}
        >
          {icon}
        </div>
        {percentage !== undefined && (
          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <TrendingUp size={16} />
            <span>{percentage}%</span>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
};

export default StatCard;
