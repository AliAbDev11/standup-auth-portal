import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle, XCircle, Clock, Palmtree, Calendar, FlaskConical,
  TrendingUp, Target, BarChart3, CalendarCheck
} from "lucide-react";

type SubmissionStatus = "submitted" | "pending" | "missed" | "on_leave" | "weekend";

interface DashboardViewProps {
  currentTime: Date;
  todayStatus: SubmissionStatus;
  submittedAt: string | null;
  streak: number;
  testMode: boolean;
  isWeekend: boolean;
  timeRemaining: string | null;
  totalSubmissions: number;
  complianceRate: number;
  thisMonthSubmissions: number;
  formatSubmittedTime: (timestamp: string) => string;
}

const DashboardView = ({
  currentTime,
  todayStatus,
  submittedAt,
  streak,
  testMode,
  isWeekend,
  timeRemaining,
  totalSubmissions,
  complianceRate,
  thisMonthSubmissions,
  formatSubmittedTime,
}: DashboardViewProps) => {
  return (
    <div className="space-y-6">
      {/* Test Mode Warning Banner */}
      {testMode && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-yellow-600 shrink-0" />
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            Test Mode Active — Time restrictions disabled
          </p>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Your standup overview and statistics</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalSubmissions}</p>
                <p className="text-xs text-muted-foreground">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200/50 dark:border-green-800/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{complianceRate}%</p>
                <p className="text-xs text-muted-foreground">Compliance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/20 border-orange-200/50 dark:border-orange-800/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{streak}</p>
                <span className="text-lg">🔥</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
            {streak >= 7 && <span className="text-sm ml-13">⭐</span>}
            {streak >= 30 && <span className="text-sm">🏆</span>}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200/50 dark:border-purple-800/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{thisMonthSubmissions}</p>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Status Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Today's Status</CardTitle>
          <CardDescription>
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/50 rounded-xl">
            <div className="text-sm">
              <span className="text-muted-foreground">Submission Window:</span>
              <span className="font-medium ml-2">8:00 AM - 10:00 AM</span>
            </div>
            {timeRemaining && !isWeekend && (
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Clock className="w-4 h-4" />
                {timeRemaining}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 p-4 border rounded-xl">
            {todayStatus === "submitted" && (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-600 text-lg">Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    at {submittedAt ? formatSubmittedTime(submittedAt) : "N/A"}
                  </p>
                </div>
              </>
            )}
            {todayStatus === "pending" && (
              <>
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-yellow-600 text-lg">Pending</p>
                  <p className="text-sm text-muted-foreground">Please submit your standup</p>
                </div>
              </>
            )}
            {todayStatus === "missed" && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-600 text-lg">Missed</p>
                  <p className="text-sm text-muted-foreground">Submission window closed</p>
                </div>
              </>
            )}
            {todayStatus === "on_leave" && (
              <>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Palmtree className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-blue-600 text-lg">On Leave</p>
                  <p className="text-sm text-muted-foreground">Approved leave request</p>
                </div>
              </>
            )}
            {todayStatus === "weekend" && (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-primary text-lg">Weekend</p>
                  <p className="text-sm text-muted-foreground">No submission required</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weekend Message */}
      {isWeekend && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <Calendar className="w-14 h-14 mx-auto text-primary/60 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Enjoy Your Weekend! 🎉</h3>
              <p className="text-muted-foreground mb-2">
                Daily standups are not required on weekends.
              </p>
              <p className="text-sm text-muted-foreground">
                Next window: Monday, 8:00 AM - 10:00 AM
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardView;