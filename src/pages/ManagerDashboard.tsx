import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  UserPlus,
  Edit,
  Eye,
  EyeOff,
  UserX,
  AlertTriangle,
  TrendingDown,
  Menu,
  Loader2,
  Palmtree,
} from "lucide-react";
import ManagerSidebar from "@/components/manager/ManagerSidebar";
import StatCard from "@/components/manager/StatCard";

type FilterType = "all" | "submitted" | "pending" | "missed" | "on_leave";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: string;
  status: string;
  submitted_at: string | null;
  submission_type?: string | null;
}

interface StandupDetail {
  id: string;
  date: string;
  yesterday_work: string;
  today_plan: string;
  blockers: string | null;
  next_steps: string | null;
  submitted_at: string;
  submission_type?: string | null;
  user_id: string;
  full_name: string;
}

interface WeeklyData {
  user_id: string;
  full_name: string;
  days: { [key: string]: string };
  compliance: number;
}

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [department, setDepartment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [standups, setStandups] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStandup, setSelectedStandup] = useState<StandupDetail | null>(null);
  const [selectedWeekStandup, setSelectedWeekStandup] = useState<StandupDetail | null>(null);
  const [showStandupDialog, setShowStandupDialog] = useState(false);
  const [showWeekStandupDialog, setShowWeekStandupDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user && department) {
      fetchTeamData();
      fetchWeeklyData();
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

  const fetchTeamData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all team members (only members, not managers)
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active, role")
        .eq("department_id", user.department_id)
        .eq("role", "member")
        .is("deleted_at", null)
        .order("full_name");

      // Fetch today's standups
      const { data: todayStandups } = await supabase
        .from("daily_standups")
        .select("*")
        .eq("date", today)
        .is("deleted_at", null);

      // Fetch today's leave requests
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("user_id")
        .eq("date", today)
        .eq("status", "approved")
        .is("deleted_at", null);

      const leaveUserIds = new Set(leaves?.map(l => l.user_id) || []);

      // Combine data
      const now = new Date();
      const currentHour = now.getHours();
      const isPastDeadline = currentHour >= 10;

      const enrichedMembers = members?.map(member => {
        const standup = todayStandups?.find(s => s.user_id === member.id);
        const isOnLeave = leaveUserIds.has(member.id);

        let status = "pending";
        if (isOnLeave) {
          status = "on_leave";
        } else if (standup) {
          status = "submitted";
        } else if (isPastDeadline) {
          status = "missed";
        }

        return {
          ...member,
          status,
          submitted_at: standup?.submitted_at || null,
          submission_type: (standup as any)?.submission_type || null,
        };
      }) || [];

      setTeamMembers(enrichedMembers);
      setStandups(todayStandups || []);
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast.error("Failed to load team data");
    }
  };

  const fetchWeeklyData = async () => {
    try {
      const today = new Date();
      const days = [];

      // Get last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
      }

      // Fetch all team members (only members)
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("department_id", user.department_id)
        .eq("role", "member")
        .is("deleted_at", null)
        .order("full_name");

      // Fetch standups for the week
      const { data: standups } = await supabase
        .from("daily_standups")
        .select("user_id, date, status")
        .in("date", days)
        .is("deleted_at", null);

      // Fetch leave requests for the week
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("user_id, date")
        .in("date", days)
        .eq("status", "approved")
        .is("deleted_at", null);

      const weekly: WeeklyData[] = members?.map(member => {
        const memberDays: { [key: string]: string } = {};
        let submittedCount = 0;

        days.forEach(day => {
          const standup = standups?.find(s => s.user_id === member.id && s.date === day);
          const leave = leaves?.find(l => l.user_id === member.id && l.date === day);

          if (leave) {
            memberDays[day] = "on_leave";
          } else if (standup) {
            memberDays[day] = "submitted";
            submittedCount++;
          } else {
            memberDays[day] = "missed";
          }
        });

        const compliance = Math.round((submittedCount / days.length) * 100);

        return {
          user_id: member.id,
          full_name: member.full_name,
          days: memberDays,
          compliance
        };
      }) || [];

      setWeeklyData(weekly);
    } catch (error) {
      console.error("Error fetching weekly data:", error);
    }
  };

  const handleViewStandup = async (userId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("daily_standups")
        .select("*, profiles(full_name)")
        .eq("user_id", userId)
        .eq("date", today)
        .is("deleted_at", null)
        .single();

      if (error) throw error;

      setSelectedStandup({
        id: data.id,
        date: data.date,
        yesterday_work: data.yesterday_work,
        today_plan: data.today_plan,
        blockers: data.blockers,
        next_steps: data.next_steps,
        submitted_at: data.submitted_at,
        submission_type: (data as any).submission_type || null,
        user_id: data.user_id,
        full_name: data.profiles.full_name
      });
      setShowStandupDialog(true);
    } catch (error) {
      console.error("Error fetching standup:", error);
      toast.error("No standup found for today");
    }
  };

  const handleViewWeekStandup = async (userId: string, date: string) => {
    try {
      const { data, error } = await supabase
        .from("daily_standups")
        .select("*, profiles(full_name)")
        .eq("user_id", userId)
        .eq("date", date)
        .is("deleted_at", null)
        .single();

      if (error) throw error;

      setSelectedWeekStandup({
        id: data.id,
        date: data.date,
        yesterday_work: data.yesterday_work,
        today_plan: data.today_plan,
        blockers: data.blockers,
        next_steps: data.next_steps,
        submitted_at: data.submitted_at,
        submission_type: (data as any).submission_type || null,
        user_id: data.user_id,
        full_name: data.profiles.full_name
      });
      setShowWeekStandupDialog(true);
    } catch (error) {
      console.error("Error fetching standup:", error);
      toast.error("No standup found for this day");
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInviteForm({ ...inviteForm, password });
    setShowPassword(true);
    navigator.clipboard.writeText(password);
    toast.success('Password generated and copied to clipboard!');
  };

  const generateEditPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditNewPassword(password);
    setShowEditPassword(true);
    navigator.clipboard.writeText(password);
    toast.success('Password generated and copied to clipboard!');
  };

  const handleInviteMember = async () => {
    try {
      if (!inviteForm.email || !inviteForm.full_name || !inviteForm.password) {
        toast.error("Please fill in all fields");
        return;
      }

      if (inviteForm.password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      setInviteLoading(true);

      // Note: Creating users requires admin API access via edge function
      // For now, show informational message
      toast.info("User creation requires admin privileges. Please contact your system administrator to create new user accounts with the following details:", {
        description: `Email: ${inviteForm.email}, Name: ${inviteForm.full_name}`,
        duration: 10000,
      });

      setShowInviteDialog(false);
      setInviteForm({ email: "", full_name: "", password: "" });
    } catch (error) {
      console.error("Error inviting member:", error);
      toast.error("Failed to invite member");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEditMember = async () => {
    try {
      setEditLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingMember.full_name,
          is_active: editingMember.is_active
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      // Note: Password change requires admin API
      if (editNewPassword) {
        toast.info("Password changes require admin privileges. Please contact your system administrator.");
      }

      toast.success("Member updated successfully");
      setShowEditDialog(false);
      setEditingMember(null);
      setEditNewPassword("");
      setShowPasswordField(false);
      fetchTeamData();
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Failed to update member");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivateMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${memberName}?\n\nThey will no longer be able to submit standups or access the system.\nTheir historical data will be preserved.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("User deactivated successfully");
      fetchTeamData();
    } catch (error) {
      console.error("Error deactivating member:", error);
      toast.error("Failed to deactivate member");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Statistics calculations (only members)
  const totalMembers = teamMembers.length;
  const submitted = teamMembers.filter(m => m.status === "submitted").length;
  const pending = teamMembers.filter(m => m.status === "pending").length;
  const missed = teamMembers.filter(m => m.status === "missed").length;
  const onLeave = teamMembers.filter(m => m.status === "on_leave").length;
  const submissionRate = totalMembers > 0 ? Math.round((submitted / totalMembers) * 100) : 0;

  // Filter members
  const filteredMembers = teamMembers.filter(member => {
    if (filter !== "all" && member.status !== filter) return false;
    if (searchQuery && !member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !member.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getDayLabel = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Get members with blockers
  const membersWithBlockers = standups.filter(s => s.blockers && s.blockers.trim().length > 0);

  // Get members with poor compliance (missed 3+ days)
  const poorCompliance = weeklyData.filter(w => {
    const missedDays = Object.values(w.days).filter(d => d === "missed").length;
    return missedDays >= 3;
  });

  // Team average compliance
  const teamCompliance = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((sum, w) => sum + w.compliance, 0) / weeklyData.length)
    : 0;

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

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
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
                <h1 className="text-2xl font-bold text-foreground">{department?.name} Team</h1>
                <p className="text-sm text-muted-foreground">Manage your team and track daily standups</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              {/* Pending indicator */}
              {pending > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 rounded-full">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">{pending} pending</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={<Users className="w-6 h-6" />}
              label="Total Members"
              value={totalMembers}
              color="blue"
            />
            <StatCard
              icon={<CheckCircle className="w-6 h-6" />}
              label="Today's Submissions"
              value={`${submitted}/${totalMembers}`}
              percentage={submissionRate}
              color="green"
            />
            <StatCard
              icon={<Clock className="w-6 h-6" />}
              label="Pending"
              value={pending}
              color="orange"
            />
            <StatCard
              icon={<XCircle className="w-6 h-6" />}
              label="Missed"
              value={missed}
              color="red"
            />
          </div>

          {/* Alerts Section */}
          {(membersWithBlockers.length > 0 || poorCompliance.length > 0) && (
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="w-5 h-5" />
                  Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {membersWithBlockers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground">Members with blockers today:</p>
                    <div className="space-y-2">
                      {membersWithBlockers.map(standup => {
                        const member = teamMembers.find(m => m.id === standup.user_id);
                        return (
                          <div key={standup.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                            <span className="text-sm font-medium">{member?.full_name}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewStandup(standup.user_id)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {poorCompliance.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2 text-foreground">
                      <TrendingDown className="w-4 h-4" />
                      Members who missed 3+ days this week:
                    </p>
                    <div className="space-y-2">
                      {poorCompliance.map(data => (
                        <div key={data.user_id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                          <span className="text-sm font-medium">{data.full_name}</span>
                          <Badge variant="destructive">
                            {Object.values(data.days).filter(d => d === "missed").length} missed
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Team Members Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>{formatDate(new Date())}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mobile Search */}
                  <div className="relative md:hidden">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-40"
                    />
                  </div>
                  <Button onClick={() => setShowInviteDialog(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { key: "all", label: "All" },
                  { key: "submitted", label: "Submitted" },
                  { key: "pending", label: "Pending" },
                  { key: "missed", label: "Missed" },
                  { key: "on_leave", label: "On Leave" },
                ].map(f => (
                  <Button
                    key={f.key}
                    variant={filter === f.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f.key as FilterType)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              {/* Members List */}
              <div className="space-y-3">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  filteredMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{member.full_name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {member.status === "submitted" && (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Submitted at {formatTime(member.submitted_at!)}
                          </Badge>
                        )}
                        {member.status === "pending" && (
                          <Badge className="bg-yellow-600 hover:bg-yellow-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        {member.status === "missed" && (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Missed
                          </Badge>
                        )}
                        {member.status === "on_leave" && (
                          <Badge className="bg-blue-600 hover:bg-blue-700">
                            <Palmtree className="w-3 h-3 mr-1" />
                            On Leave
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          {member.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewStandup(member.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingMember(member);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {member.is_active && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeactivateMember(member.id, member.full_name)}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Overview (Last 7 Days)</CardTitle>
              <CardDescription>Team compliance: {teamCompliance}% this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-foreground">Team Member</th>
                      {weeklyData.length > 0 && Object.keys(weeklyData[0].days).map(date => (
                        <th key={date} className="text-center p-2 font-medium text-sm text-foreground">
                          {getDayLabel(date)}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(date).getDate()}
                          </span>
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium text-foreground">Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.map(member => (
                      <tr key={member.user_id} className="border-b border-border hover:bg-accent/50">
                        <td className="p-2 font-medium text-foreground">{member.full_name}</td>
                        {Object.entries(member.days).map(([date, status]) => (
                          <td key={date} className="text-center p-2">
                            <button
                              onClick={() => status === "submitted" && handleViewWeekStandup(member.user_id, date)}
                              className="cursor-pointer disabled:cursor-default"
                              disabled={status !== "submitted"}
                            >
                              {status === "submitted" && <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />}
                              {status === "missed" && <XCircle className="w-5 h-5 text-red-600 mx-auto" />}
                              {status === "on_leave" && <Palmtree className="w-5 h-5 text-blue-600 mx-auto" />}
                            </button>
                          </td>
                        ))}
                        <td className="text-center p-2">
                          <Badge variant={member.compliance >= 80 ? "default" : "secondary"}>
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
      </main>

      {/* View Standup Dialog */}
      <Dialog open={showStandupDialog} onOpenChange={setShowStandupDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Daily Standup - {selectedStandup?.full_name}</DialogTitle>
            <DialogDescription>
              {selectedStandup?.date && formatDate(new Date(selectedStandup.date))} •
              Submitted at {selectedStandup?.submitted_at && formatTime(selectedStandup.submitted_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedStandup && (
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">What did you accomplish yesterday?</Label>
                <p className="mt-1 text-sm text-muted-foreground">{selectedStandup.yesterday_work}</p>
              </div>
              <div>
                <Label className="font-semibold">What are you working on today?</Label>
                <p className="mt-1 text-sm text-muted-foreground">{selectedStandup.today_plan}</p>
              </div>
              {selectedStandup.blockers && (
                <div>
                  <Label className="font-semibold text-orange-600">Any blockers or issues?</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedStandup.blockers}</p>
                </div>
              )}
              {selectedStandup.next_steps && (
                <div>
                  <Label className="font-semibold">Next steps?</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedStandup.next_steps}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Week Standup Dialog */}
      <Dialog open={showWeekStandupDialog} onOpenChange={setShowWeekStandupDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Daily Standup - {selectedWeekStandup?.full_name}</DialogTitle>
            <DialogDescription>
              {selectedWeekStandup?.date && formatDate(new Date(selectedWeekStandup.date))} •
              Submitted at {selectedWeekStandup?.submitted_at && formatTime(selectedWeekStandup.submitted_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedWeekStandup && (
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">What did you accomplish yesterday?</Label>
                <p className="mt-1 text-sm text-muted-foreground">{selectedWeekStandup.yesterday_work}</p>
              </div>
              <div>
                <Label className="font-semibold">What are you working on today?</Label>
                <p className="mt-1 text-sm text-muted-foreground">{selectedWeekStandup.today_plan}</p>
              </div>
              {selectedWeekStandup.blockers && (
                <div>
                  <Label className="font-semibold text-orange-600">Any blockers or issues?</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedWeekStandup.blockers}</p>
                </div>
              )}
              {selectedWeekStandup.next_steps && (
                <div>
                  <Label className="font-semibold">Next steps?</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedWeekStandup.next_steps}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to the {department?.name} team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-name">Full Name *</Label>
              <Input
                id="invite-name"
                type="text"
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="john.doe@company.com"
              />
            </div>
            <div>
              <Label htmlFor="invite-password">Password *</Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Password must be at least 8 characters
              </p>
            </div>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Generate Secure Password
            </button>
            <div>
              <Label>Department</Label>
              <Input
                type="text"
                value={department?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteMember} disabled={inviteLoading}>
                {inviteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update member information
            </DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  type="text"
                  value={editingMember.full_name}
                  onChange={(e) => setEditingMember({ ...editingMember, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email Address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingMember.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed. Create a new account if needed.
                </p>
              </div>

              {/* Change Password Section */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Change Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordField(!showPasswordField)}
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    {showPasswordField ? 'Cancel' : 'Change Password'}
                  </button>
                </div>

                {showPasswordField && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showEditPassword ? "text" : "password"}
                        value={editNewPassword}
                        onChange={(e) => setEditNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={generateEditPassword}
                      className="text-sm text-primary hover:text-primary/80"
                    >
                      Generate Secure Password
                    </button>
                  </div>
                )}
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="font-medium text-foreground">Active Status</p>
                  <p className="text-sm text-muted-foreground">Allow this member to log in</p>
                </div>
                <Switch
                  checked={editingMember.is_active}
                  onCheckedChange={(checked) => setEditingMember({ ...editingMember, is_active: checked })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowEditDialog(false);
                  setEditingMember(null);
                  setEditNewPassword("");
                  setShowPasswordField(false);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleEditMember} disabled={editLoading}>
                  {editLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
