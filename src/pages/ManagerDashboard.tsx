import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { LogOut, Users, CheckCircle, XCircle, Clock, Palmtree, Search, ChevronDown, UserPlus, Edit, Eye, UserX, AlertTriangle, TrendingDown } from "lucide-react";

type FilterType = "all" | "submitted" | "pending" | "missed" | "on_leave";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
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
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "" });
  const [userManagementOpen, setUserManagementOpen] = useState(false);

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
      
      // Fetch all team members
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .eq("department_id", user.department_id)
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

      // Fetch all team members
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("department_id", user.department_id)
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

  const handleInviteMember = async () => {
    try {
      if (!inviteForm.email || !inviteForm.full_name) {
        toast.error("Please fill in all fields");
        return;
      }

      // This would require a server-side function to create users
      // For now, show a message that admin needs to create the account
      toast.info("Please contact system administrator to create new user accounts");
      
      setShowInviteDialog(false);
      setInviteForm({ email: "", full_name: "" });
    } catch (error) {
      console.error("Error inviting member:", error);
      toast.error("Failed to invite member");
    }
  };

  const handleEditMember = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingMember.full_name,
          is_active: editingMember.is_active
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      toast.success("Member updated successfully");
      setShowEditDialog(false);
      setEditingMember(null);
      fetchTeamData();
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Failed to update member");
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Statistics calculations
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Manager Dashboard</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Welcome, {user?.full_name}</p>
                {department && (
                  <Badge variant="outline" className="text-xs">
                    {department.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* SECTION 1: TEAM OVERVIEW */}
          <Card>
            <CardHeader>
              <CardTitle>{department?.name} Team - Daily Standup Status</CardTitle>
              <CardDescription>{formatDate(new Date())}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Members</p>
                      <p className="text-3xl font-bold">{totalMembers}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Submitted</p>
                      <p className="text-3xl font-bold text-green-600">{submitted}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-3xl font-bold text-yellow-600">{pending}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-600" />
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Missed</p>
                      <p className="text-3xl font-bold text-red-600">{missed}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Submission Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    {submitted}/{totalMembers} submitted ({submissionRate}%)
                  </p>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="bg-green-600 h-full" 
                    style={{ width: `${(submitted / totalMembers) * 100}%` }}
                  />
                  <div 
                    className="bg-yellow-600 h-full" 
                    style={{ width: `${(pending / totalMembers) * 100}%` }}
                  />
                  <div 
                    className="bg-red-600 h-full" 
                    style={{ width: `${(missed / totalMembers) * 100}%` }}
                  />
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button 
                  variant={filter === "submitted" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("submitted")}
                >
                  Submitted
                </Button>
                <Button 
                  variant={filter === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("pending")}
                >
                  Pending
                </Button>
                <Button 
                  variant={filter === "missed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("missed")}
                >
                  Missed
                </Button>
                <Button 
                  variant={filter === "on_leave" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("on_leave")}
                >
                  On Leave
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 5: BLOCKERS & ALERTS */}
          {(membersWithBlockers.length > 0 || poorCompliance.length > 0) && (
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {membersWithBlockers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Members with blockers today:</p>
                    <div className="space-y-1">
                      {membersWithBlockers.map(standup => {
                        const member = teamMembers.find(m => m.id === standup.user_id);
                        return (
                          <div key={standup.id} className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-sm">{member?.full_name}</span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleViewStandup(standup.user_id)}
                            >
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
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Members who missed 3+ days this week:
                    </p>
                    <div className="space-y-1">
                      {poorCompliance.map(data => (
                        <div key={data.user_id} className="flex items-center justify-between p-2 bg-background rounded">
                          <span className="text-sm">{data.full_name}</span>
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

          {/* SECTION 2: TEAM MEMBERS LIST */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Members - Today's Status</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  filteredMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {member.status === "submitted" && (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            ✅ Submitted at {formatTime(member.submitted_at!)}
                          </Badge>
                        )}
                        {member.status === "pending" && (
                          <Badge className="bg-yellow-600 hover:bg-yellow-700">
                            ⏳ Pending
                          </Badge>
                        )}
                        {member.status === "missed" && (
                          <Badge variant="destructive">
                            ❌ Missed
                          </Badge>
                        )}
                        {member.status === "on_leave" && (
                          <Badge className="bg-blue-600 hover:bg-blue-700">
                            🏖️ On Leave
                          </Badge>
                        )}
                        {member.status === "submitted" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewStandup(member.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Standup
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: WEEKLY OVERVIEW */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Overview (Last 7 Days)</CardTitle>
              <CardDescription>
                Team compliance: {teamCompliance}% this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Team Member</th>
                      {weeklyData.length > 0 && Object.keys(weeklyData[0].days).map(date => (
                        <th key={date} className="text-center p-2 font-medium text-sm">
                          {getDayLabel(date)}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(date).getDate()}
                          </span>
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium">Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.map(member => (
                      <tr key={member.user_id} className="border-b hover:bg-accent">
                        <td className="p-2 font-medium">{member.full_name}</td>
                        {Object.entries(member.days).map(([date, status]) => (
                          <td key={date} className="text-center p-2">
                            <button 
                              onClick={() => status === "submitted" && handleViewWeekStandup(member.user_id, date)}
                              className="cursor-pointer"
                              disabled={status !== "submitted"}
                            >
                              {status === "submitted" && <span className="text-green-600 text-xl">✅</span>}
                              {status === "missed" && <span className="text-red-600 text-xl">❌</span>}
                              {status === "on_leave" && <span className="text-blue-600 text-xl">🏖️</span>}
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

          {/* SECTION 4: USER MANAGEMENT */}
          <Collapsible open={userManagementOpen} onOpenChange={setUserManagementOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent">
                  <div className="flex items-center justify-between">
                    <CardTitle>Team Management</CardTitle>
                    <ChevronDown className={`w-5 h-5 transition-transform ${userManagementOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={() => setShowInviteDialog(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite New Member
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {teamMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.full_name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={member.is_active ? "default" : "secondary"}>
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingMember(member);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          {member.is_active && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeactivateMember(member.id, member.full_name)}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
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
                <p className="mt-1 text-sm">{selectedStandup.yesterday_work}</p>
              </div>
              <div>
                <Label className="font-semibold">What are you working on today?</Label>
                <p className="mt-1 text-sm">{selectedStandup.today_plan}</p>
              </div>
              {selectedStandup.blockers && (
                <div>
                  <Label className="font-semibold text-orange-600">Any blockers or issues?</Label>
                  <p className="mt-1 text-sm">{selectedStandup.blockers}</p>
                </div>
              )}
              {selectedStandup.next_steps && (
                <div>
                  <Label className="font-semibold">Next steps?</Label>
                  <p className="mt-1 text-sm">{selectedStandup.next_steps}</p>
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
                <p className="mt-1 text-sm">{selectedWeekStandup.yesterday_work}</p>
              </div>
              <div>
                <Label className="font-semibold">What are you working on today?</Label>
                <p className="mt-1 text-sm">{selectedWeekStandup.today_plan}</p>
              </div>
              {selectedWeekStandup.blockers && (
                <div>
                  <Label className="font-semibold text-orange-600">Any blockers or issues?</Label>
                  <p className="mt-1 text-sm">{selectedWeekStandup.blockers}</p>
                </div>
              )}
              {selectedWeekStandup.next_steps && (
                <div>
                  <Label className="font-semibold">Next steps?</Label>
                  <p className="mt-1 text-sm">{selectedWeekStandup.next_steps}</p>
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
            <DialogTitle>Invite New Member</DialogTitle>
            <DialogDescription>
              Add a new member to the {department?.name} team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="member@company.com"
              />
            </div>
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
              <Label>Department</Label>
              <Input
                type="text"
                value={department?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteMember}>
                Send Invitation
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
                <Label htmlFor="edit-email">Email (cannot be changed)</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingMember.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed. Create a new account if needed.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editingMember.is_active}
                  onChange={(e) => setEditingMember({ ...editingMember, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="edit-active" className="cursor-pointer">
                  Active Status
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowEditDialog(false);
                  setEditingMember(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleEditMember}>
                  Save Changes
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
