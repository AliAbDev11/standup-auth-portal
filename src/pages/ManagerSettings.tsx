import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  LogOut,
  Menu,
} from "lucide-react";
import ManagerSidebar from "@/components/manager/ManagerSidebar";

const ManagerSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [department, setDepartment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    teamSize: 0,
    avgCompliance: 0,
    activeIssues: 0,
  });
  const [preferences, setPreferences] = useState({
    dailySummary: true,
    blockerAlerts: true,
    lowComplianceAlerts: true,
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user && department) {
      fetchStats();
    }
  }, [user, department]);

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*, departments(id, name)")
        .eq("id", authUser.id)
        .is("deleted_at", null)
        .single();

      if (profile?.role !== "manager") {
        toast.error("Access denied. Managers only.");
        navigate("/auth");
        return;
      }

      setUser(profile);
      setDepartment(profile.departments);
    } catch (error) {
      console.error("Error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch team members (only members, not managers)
      const { data: members } = await supabase
        .from("profiles")
        .select("id")
        .eq("department_id", user.department_id)
        .eq("role", "member")
        .is("deleted_at", null);

      const teamSize = members?.length || 0;

      // Calculate compliance for last 7 days
      const today = new Date();
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
      }

      const { data: standups } = await supabase
        .from("daily_standups")
        .select("user_id, date")
        .in("date", days)
        .is("deleted_at", null);

      const totalPossible = teamSize * 7;
      const totalSubmitted = standups?.length || 0;
      const avgCompliance = totalPossible > 0 ? Math.round((totalSubmitted / totalPossible) * 100) : 0;

      // Count blockers today
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: blockers } = await supabase
        .from("daily_standups")
        .select("id")
        .eq("date", todayStr)
        .not("blockers", "is", null)
        .neq("blockers", "")
        .is("deleted_at", null);

      setStats({
        teamSize,
        avgCompliance,
        activeIssues: blockers?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const updatePreference = (key: keyof typeof preferences, value: boolean) => {
    setPreferences({ ...preferences, [key]: value });
    toast.success("Preference updated");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-accent/30">
      <ManagerSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        manager={{
          full_name: user?.full_name || "",
          department_name: department?.name || "",
        }}
        onLogout={handleLogout}
      />

      <main
        className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"
          }`}
      >
        {/* Top Header */}
        <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-accent rounded-lg lg:hidden"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your preferences and profile
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Info */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-muted-foreground">Full Name</label>
                    <p className="font-medium text-foreground">{user?.full_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium text-foreground">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Department</label>
                    <p className="font-medium text-foreground">{department?.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Role</label>
                    <p className="font-medium text-foreground capitalize">Manager</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Member Since</label>
                    <p className="font-medium text-foreground">
                      {user?.created_at ? formatDate(user.created_at) : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Team Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Team Size</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.teamSize}</p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-950/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-muted-foreground">Avg Compliance</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.avgCompliance}%</p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-950/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <span className="text-sm text-muted-foreground">Active Issues</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.activeIssues}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Daily Summary Email</p>
                    <p className="text-sm text-muted-foreground">
                      Receive daily summary at 10:05 AM
                    </p>
                  </div>
                  <Switch
                    checked={preferences.dailySummary}
                    onCheckedChange={(val) => updatePreference("dailySummary", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Blocker Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when members report blockers
                    </p>
                  </div>
                  <Switch
                    checked={preferences.blockerAlerts}
                    onCheckedChange={(val) => updatePreference("blockerAlerts", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Low Compliance Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Alert when team compliance drops below 70%
                    </p>
                  </div>
                  <Switch
                    checked={preferences.lowComplianceAlerts}
                    onCheckedChange={(val) => updatePreference("lowComplianceAlerts", val)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline">Change Password</Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Need help or have concerns? Contact your system administrator.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerSettings;
