import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WeeklyData {
  user_id: string;
  full_name: string;
  days: { [key: string]: string };
  compliance: number;
}

interface AttendanceViewProps {
  weeklyData: WeeklyData[];
  teamCompliance: number;
  onViewStandup: (userId: string, date: string) => void;
}

export const AttendanceView = ({ weeklyData, teamCompliance, onViewStandup }: AttendanceViewProps) => {
  const getDayLabel = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (date: string) => {
    return new Date(date).getDate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return <span className="w-6 h-6 rounded-full bg-[hsl(var(--status-success))]/20 flex items-center justify-center text-xs">✓</span>;
      case "missed":
        return <span className="w-6 h-6 rounded-full bg-[hsl(var(--status-danger))]/20 flex items-center justify-center text-xs">✗</span>;
      case "on_leave":
        return <span className="w-6 h-6 rounded-full bg-[hsl(var(--status-info))]/20 flex items-center justify-center text-xs">🏖</span>;
      default:
        return <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">-</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Weekly Attendance</h2>
          <p className="text-sm text-muted-foreground">Last 7 days overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Team Compliance:</span>
          <Badge 
            variant={teamCompliance >= 80 ? "default" : "secondary"}
            className={cn(teamCompliance >= 80 && "bg-[hsl(var(--status-success))]")}
          >
            {teamCompliance}%
          </Badge>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--status-success))]/40" />
          Submitted
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--status-danger))]/40" />
          Missed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--status-info))]/40" />
          On Leave
        </div>
      </div>

      {/* Grid */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-sm sticky left-0 bg-muted/30">Member</th>
                  {weeklyData.length > 0 && Object.keys(weeklyData[0].days).map(date => (
                    <th key={date} className="text-center p-3 font-medium text-xs min-w-[60px]">
                      <div>{getDayLabel(date)}</div>
                      <div className="text-muted-foreground font-normal">{getDayNumber(date)}</div>
                    </th>
                  ))}
                  <th className="text-center p-3 font-medium text-sm">Rate</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map(member => (
                  <tr key={member.user_id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-card">
                      <span className="truncate block max-w-[150px]">{member.full_name}</span>
                    </td>
                    {Object.entries(member.days).map(([date, status]) => (
                      <td key={date} className="text-center p-3">
                        <button 
                          onClick={() => status === "submitted" && onViewStandup(member.user_id, date)}
                          className={cn(
                            "inline-flex items-center justify-center",
                            status === "submitted" && "cursor-pointer hover:scale-110 transition-transform"
                          )}
                          disabled={status !== "submitted"}
                        >
                          {getStatusIcon(status)}
                        </button>
                      </td>
                    ))}
                    <td className="text-center p-3">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-xs",
                          member.compliance >= 80 && "border-[hsl(var(--status-success))] text-[hsl(var(--status-success))]",
                          member.compliance < 80 && member.compliance >= 50 && "border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))]",
                          member.compliance < 50 && "border-[hsl(var(--status-danger))] text-[hsl(var(--status-danger))]"
                        )}
                      >
                        {member.compliance}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
