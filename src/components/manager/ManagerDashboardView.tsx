import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, Clock, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

interface DashboardViewProps {
  stats: {
    total: number;
    submitted: number;
    pending: number;
    missed: number;
    onLeave: number;
    submissionRate: number;
  };
  weeklyData: Array<{
    user_id: string;
    full_name: string;
    days: { [key: string]: string };
    compliance: number;
  }>;
  standups: Array<{
    blockers: string | null;
    user_id: string;
  }>;
  teamMembers: Array<{
    id: string;
    full_name: string;
  }>;
  onViewAttention: () => void;
}

export const ManagerDashboardView = ({ 
  stats, 
  weeklyData, 
  standups,
  teamMembers,
  onViewAttention 
}: DashboardViewProps) => {
  // Prepare chart data
  const activityData = weeklyData.length > 0 
    ? Object.keys(weeklyData[0]?.days || {}).map(date => {
        const submitted = weeklyData.filter(w => w.days[date] === "submitted").length;
        const total = weeklyData.length;
        return {
          day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          rate: total > 0 ? Math.round((submitted / total) * 100) : 0,
        };
      })
    : [];

  const statusData = [
    { name: "Submitted", value: stats.submitted, color: "hsl(142 76% 36%)" },
    { name: "Pending", value: stats.pending, color: "hsl(45 93% 47%)" },
    { name: "Missed", value: stats.missed, color: "hsl(0 84% 60%)" },
  ].filter(d => d.value > 0);

  // Get blockers for bar chart
  const membersWithBlockers = standups.filter(s => s.blockers && s.blockers.trim().length > 0);
  const blockerData = membersWithBlockers.slice(0, 5).map(standup => {
    const member = teamMembers.find(m => m.id === standup.user_id);
    return {
      name: member?.full_name?.split(' ')[0] || 'Unknown',
      blockers: 1,
    };
  });

  // Members with poor compliance
  const poorCompliance = weeklyData.filter(w => {
    const missedDays = Object.values(w.days).filter(d => d === "missed").length;
    return missedDays >= 3;
  });

  const attentionCount = membersWithBlockers.length + poorCompliance.length;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                <p className="text-2xl font-bold mt-1 text-[hsl(var(--status-success))]">{stats.submitted}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--status-success))]/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[hsl(var(--status-success))]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold mt-1 text-[hsl(var(--status-warning))]">{stats.pending}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--status-warning))]/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[hsl(var(--status-warning))]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Missed</p>
                <p className="text-2xl font-bold mt-1 text-[hsl(var(--status-danger))]">{stats.missed}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--status-danger))]/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-[hsl(var(--status-danger))]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Today's Progress</p>
            <p className="text-sm text-muted-foreground">
              {stats.submitted}/{stats.total} submitted ({stats.submissionRate}%)
            </p>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
            <div 
              className="bg-[hsl(var(--status-success))] h-full transition-all" 
              style={{ width: `${(stats.submitted / stats.total) * 100}%` }}
            />
            <div 
              className="bg-[hsl(var(--status-warning))] h-full transition-all" 
              style={{ width: `${(stats.pending / stats.total) * 100}%` }}
            />
            <div 
              className="bg-[hsl(var(--status-danger))] h-full transition-all" 
              style={{ width: `${(stats.missed / stats.total) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity Trend */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Trend (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityData}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis axisLine={false} tickLine={false} className="text-xs" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Submission Rate']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown Donut */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blockers Chart & Action Items */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Blockers Bar Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Members with Blockers Today</CardTitle>
          </CardHeader>
          <CardContent>
            {blockerData.length > 0 ? (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={blockerData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      className="text-xs"
                      width={80}
                    />
                    <Bar 
                      dataKey="blockers" 
                      fill="hsl(var(--status-warning))" 
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No blockers reported today ✨</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Items Widget */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))]" />
              Action Items
            </CardTitle>
            {attentionCount > 0 && (
              <Badge variant="secondary" className="text-xs">{attentionCount}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {attentionCount > 0 ? (
              <div className="space-y-2">
                {membersWithBlockers.slice(0, 3).map((standup, idx) => {
                  const member = teamMembers.find(m => m.id === standup.user_id);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--status-warning))]" />
                      <span className="truncate">{member?.full_name} has blocker</span>
                    </div>
                  );
                })}
                {poorCompliance.slice(0, 2).map((data, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--status-danger))]" />
                    <span className="truncate">{data.full_name} missed 3+ days</span>
                  </div>
                ))}
                {attentionCount > 5 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-xs"
                    onClick={onViewAttention}
                  >
                    View All ({attentionCount})
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">All clear! 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
