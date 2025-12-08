import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { ManagerSidebar } from "@/components/manager/ManagerSidebar";
import { ManagerDashboardView } from "@/components/manager/ManagerDashboardView";
import { TeamStatusView } from "@/components/manager/TeamStatusView";
import { AttendanceView } from "@/components/manager/AttendanceView";
import { ManagementView } from "@/components/manager/ManagementView";

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
  const [currentView, setCurrentView] = useState("dashboard");
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [standups, setStandups] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  
  // Dialog states
  const [selectedStandup, setSelectedStandup] = useState<StandupDetail | null>(null);
  const [showStandupDialog, setShowStandupDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "" });

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
      
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .eq("department_id", user.department_id)
        .is("deleted_at", null)
        .order("full_name");

      const { data: todayStandups } = await supabase
        .from("daily_standups")
        .select("*")
        .eq("date", today)
        .is("deleted_at", null);

      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("user_id")
        .eq("date", today)
        .eq("status", "approved")
        .is("deleted_at", null);

      const leaveUserIds = new Set(leaves?.map(l => l.user_id) || []);
      
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
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
      }

      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("department_id", user.department_id)
        .is("deleted_at", null)
        .order("full_name");

      const { data: standups } = await supabase
        .from("daily_standups")
        .select("user_id, date, status")
        .in("date", days)
        .is("deleted_at", null);

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

  const handleViewStandup = async (userId: string, date?: string) => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("daily_standups")
        .select("*, profiles(full_name)")
        .eq("user_id", userId)
        .eq("date", targetDate)
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
      toast.error("No standup found for this day");
    }
  };

  const handleInviteMember = async () => {
    try {
      if (!inviteForm.email || !inviteForm.full_name) {
        toast.error("Please fill in all fields");
        return;
      }
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
    if (!confirm(`Are you sure you want to deactivate ${memberName}?`)) return;

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

  // Stats calculations
  const stats = {
    total: teamMembers.length,
    submitted: teamMembers.filter(m => m.status === "submitted").length,
    pending: teamMembers.filter(m => m.status === "pending").length,
    missed: teamMembers.filter(m => m.status === "missed").length,
    onLeave: teamMembers.filter(m => m.status === "on_leave").length,
    submissionRate: teamMembers.length > 0 
      ? Math.round((teamMembers.filter(m => m.status === "submitted").length / teamMembers.length) * 100) 
      : 0
  };

  const teamCompliance = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((sum, w) => sum + w.compliance, 0) / weeklyData.length)
    : 0;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <ManagerDashboardView 
            stats={stats}
            weeklyData={weeklyData}
            standups={standups}
            teamMembers={teamMembers}
            onViewAttention={() => setCurrentView("team-status")}
          />
        );
      case "team-status":
        return (
          <TeamStatusView 
            teamMembers={teamMembers}
            onViewStandup={(userId) => handleViewStandup(userId)}
          />
        );
      case "attendance":
        return (
          <AttendanceView 
            weeklyData={weeklyData}
            teamCompliance={teamCompliance}
            onViewStandup={handleViewStandup}
          />
        );
      case "management":
        return (
          <ManagementView 
            teamMembers={teamMembers}
            onInvite={() => setShowInviteDialog(true)}
            onEdit={(member) => {
              setEditingMember(member);
              setShowEditDialog(true);
            }}
            onDeactivate={handleDeactivateMember}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <ManagerSidebar 
        user={user}
        department={department}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold capitalize">
                {currentView === "team-status" ? "Team Status" : currentView}
              </h1>
              <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {renderCurrentView()}
        </div>
      </main>

      {/* View Standup Dialog */}
      <Dialog open={showStandupDialog} onOpenChange={setShowStandupDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedStandup?.full_name}'s Standup</DialogTitle>
            <DialogDescription>
              {selectedStandup?.date && formatDate(new Date(selectedStandup.date))} • 
              {selectedStandup?.submitted_at && ` Submitted at ${formatTime(selectedStandup.submitted_at)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedStandup && (
            <div className="space-y-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Yesterday</Label>
                <p className="mt-1">{selectedStandup.yesterday_work}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Today</Label>
                <p className="mt-1">{selectedStandup.today_plan}</p>
              </div>
              {selectedStandup.blockers && (
                <div>
                  <Label className="text-xs text-[hsl(var(--status-warning))] uppercase tracking-wide">Blockers</Label>
                  <p className="mt-1">{selectedStandup.blockers}</p>
                </div>
              )}
              {selectedStandup.next_steps && (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Next Steps</Label>
                  <p className="mt-1">{selectedStandup.next_steps}</p>
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
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@company.com"
              />
            </div>
            <Button onClick={handleInviteMember} className="w-full">
              Send Invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={editingMember.full_name}
                  onChange={(e) => setEditingMember((prev: any) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editingMember.email} disabled className="bg-muted" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active Status</Label>
                <Switch
                  checked={editingMember.is_active}
                  onCheckedChange={(checked) => 
                    setEditingMember((prev: any) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
              <Button onClick={handleEditMember} className="w-full">
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
