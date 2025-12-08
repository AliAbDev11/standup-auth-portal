import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, User, BarChart3, Settings, Lock, AlertTriangle } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string;
  department_name?: string;
  created_at: string;
}

interface UserStats {
  total: number;
  thisMonth: number;
  compliance: number;
  streak: number;
}

const MemberSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    thisMonth: 0,
    compliance: 0,
    streak: 0
  });
  
  // Preferences
  const [emailReminders, setEmailReminders] = useState(true);
  const [showInstructions, setShowInstructions] = useState(() => {
    return localStorage.getItem("hideInstructions") !== "true";
  });
  const [preferredMethod, setPreferredMethod] = useState(() => {
    return localStorage.getItem("preferredSubmissionMethod") || "text";
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        navigate("/auth");
        return;
      }

      // Fetch profile with department name
      const { data: profile } = await supabase
        .from("profiles")
        .select(`
          *,
          departments:department_id (name)
        `)
        .eq("id", authUser.id)
        .single();

      if (profile?.role !== "member") {
        toast.error("Access denied. Members only.");
        navigate("/auth");
        return;
      }

      const userWithDept = {
        ...profile,
        department_name: profile.departments?.name || "Unknown"
      };
      setUser(userWithDept);
      await fetchStats(authUser.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (userId: string) => {
    try {
      // Total submissions
      const { count: totalCount } = await supabase
        .from("daily_standups")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "submitted");

      // This month submissions
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: monthCount } = await supabase
        .from("daily_standups")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "submitted")
        .gte("date", startOfMonth.toISOString().split('T')[0]);

      // Calculate streak
      const streak = await calculateStreak(userId);

      // Calculate compliance (last 30 weekdays)
      const compliance = await calculateCompliance(userId);

      setStats({
        total: totalCount || 0,
        thisMonth: monthCount || 0,
        compliance,
        streak
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const calculateStreak = async (userId: string): Promise<number> => {
    const { data: submissions } = await supabase
      .from("daily_standups")
      .select("date")
      .eq("user_id", userId)
      .eq("status", "submitted")
      .order("date", { ascending: false })
      .limit(60);

    if (!submissions || submissions.length === 0) return 0;

    const submittedDates = new Set(submissions.map(s => s.date));
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Check if today is a weekday and has submission
    const today = currentDate.toISOString().split('T')[0];
    const todayDay = currentDate.getDay();
    
    // If today is a weekday and not submitted yet, start from yesterday
    if (todayDay !== 0 && todayDay !== 6 && !submittedDates.has(today)) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Count consecutive weekday submissions
    for (let i = 0; i < 60; i++) {
      const day = currentDate.getDay();
      
      // Skip weekends
      if (day === 0 || day === 6) {
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }

      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (submittedDates.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const calculateCompliance = async (userId: string): Promise<number> => {
    // Count weekdays in last 30 days
    let weekdays = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const day = checkDate.getDay();
      if (day !== 0 && day !== 6) {
        weekdays++;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count } = await supabase
      .from("daily_standups")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "submitted")
      .gte("date", thirtyDaysAgo.toISOString().split('T')[0]);

    return weekdays > 0 ? Math.round(((count || 0) / weekdays) * 100) : 0;
  };

  const handleShowInstructionsChange = (checked: boolean) => {
    setShowInstructions(checked);
    localStorage.setItem("hideInstructions", (!checked).toString());
    toast.success(checked ? "Instructions will be shown" : "Instructions hidden");
  };

  const handlePreferredMethodChange = (value: string) => {
    setPreferredMethod(value);
    localStorage.setItem("preferredSubmissionMethod", value);
    toast.success("Preferred method updated");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/member/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>Profile Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-muted-foreground">Full Name</label>
                  <p className="font-medium">{user?.full_name}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Department</label>
                  <p className="font-medium">{user?.department_name}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Role</label>
                  <p className="font-medium capitalize">{user?.role}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Member Since</label>
                  <p className="font-medium">{user?.created_at ? formatDate(user.created_at) : "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-primary" />
                <CardTitle>Your Statistics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Submissions</div>
                  <div className="text-2xl font-bold text-primary">{stats.total}</div>
                </div>
                <div className="bg-green-500/10 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Compliance Rate</div>
                  <div className="text-2xl font-bold text-green-600">{stats.compliance}%</div>
                </div>
                <div className="bg-orange-500/10 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Current Streak</div>
                  <div className="text-2xl font-bold text-orange-600">{stats.streak} days</div>
                </div>
                <div className="bg-purple-500/10 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">This Month</div>
                  <div className="text-2xl font-bold text-purple-600">{stats.thisMonth}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <CardTitle>Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Reminders</p>
                  <p className="text-sm text-muted-foreground">Receive reminder at 9:30 AM if not submitted</p>
                </div>
                <Switch
                  checked={emailReminders}
                  onCheckedChange={setEmailReminders}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show Instructions</p>
                  <p className="text-sm text-muted-foreground">Display submission tips for audio/image</p>
                </div>
                <Switch
                  checked={showInstructions}
                  onCheckedChange={handleShowInstructionsChange}
                />
              </div>

              <div>
                <label className="font-medium block mb-2">Preferred Submission Method</label>
                <Select value={preferredMethod} onValueChange={handlePreferredMethodChange}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <CardTitle>Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => toast.info("Password change coming soon")}>
                Change Password
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <CardTitle className="text-destructive">Need Help?</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                If you have concerns or need assistance, please contact your manager or admin.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MemberSettings;
