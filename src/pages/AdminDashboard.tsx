import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseAdmin } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  LogOut, Shield, LayoutDashboard, Users, Building2, FileText,
  ArrowLeftRight, ScrollText, Settings, UserPlus, Edit, Eye,
  UserX, Search, ChevronDown, AlertTriangle, TrendingDown,
  CheckCircle, XCircle, Clock, Download, RotateCcw, EyeOff, Calendar
} from "lucide-react";
import { DeliverableTracker } from "@/components/deliverables/DeliverableTracker";
import { AllUserTodos } from "@/components/todos/AllUserTodos";

type Section = "overview" | "users" | "departments" | "standups" | "transfers" | "audit" | "settings";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "member" | "manager" | "superadmin";
  department_id: string;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface DailyStandup {
  id: string;
  user_id: string;
  date: string;
  yesterday_work: string;
  today_plan: string;
  blockers: string | null;
  next_steps: string | null;
  submitted_at: string;
  status: string;
}

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  old_values: any;
  new_values: any;
  metadata: any;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("overview");

  // Data states
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [standups, setStandups] = useState<DailyStandup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMembers: 0,
    totalManagers: 0,
    totalDepartments: 0,
    todaySubmissions: 0,
    todayTotal: 0,
    issuesCount: 0
  });

  // Filter states
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userDeptFilter, setUserDeptFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");

  // Modal states
  const [addUserModal, setAddUserModal] = useState(false);
  const [editUserModal, setEditUserModal] = useState(false);
  const [viewHistoryModal, setViewHistoryModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [addDeptModal, setAddDeptModal] = useState(false);
  const [editDeptModal, setEditDeptModal] = useState(false);
  const [viewStandupModal, setViewStandupModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedStandup, setSelectedStandup] = useState<DailyStandup | null>(null);
  const [userHistory, setUserHistory] = useState<DailyStandup[]>([]);

  // Form states
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    full_name: "",
    role: "member" as "member" | "manager" | "superadmin",
    department_id: "",
    password: "",
    send_invite: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    full_name: "",
    role: "member" as "member" | "manager" | "superadmin",
    is_active: true
  });
  const [transferForm, setTransferForm] = useState({
    new_department_id: "",
    reason: "",
    notify_user: true,
    notify_old_manager: true,
    notify_new_manager: true
  });
  const [newDeptForm, setNewDeptForm] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, activeSection]);

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (profile?.role !== "superadmin") {
        toast.error("Access denied. Superadmins only.");
        navigate("/auth");
        return;
      }

      setUser(profile);
    } catch (error) {
      console.error("Error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      // Fetch all users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersData) {
        setAllUsers(usersData);
        const activeUsers = usersData.filter(u => !u.deleted_at);
        setStats(prev => ({
          ...prev,
          totalUsers: activeUsers.length,
          totalMembers: activeUsers.filter(u => u.role === "member").length,
          totalManagers: activeUsers.filter(u => u.role === "manager").length
        }));
      }

      // Fetch departments
      const { data: depsData } = await supabase
        .from("departments")
        .select("*")
        .is("deleted_at", null)
        .order("name");

      if (depsData) {
        setDepartments(depsData);
        setStats(prev => ({ ...prev, totalDepartments: depsData.length }));
      }

      // Fetch today's standups
      const today = new Date().toISOString().split("T")[0];
      const { data: standupsData } = await supabase
        .from("daily_standups")
        .select("*")
        .eq("date", today)
        .is("deleted_at", null);

      if (standupsData) {
        const activeMembers = usersData?.filter(u => u.role === "member" && !u.deleted_at).length || 0;
        setStats(prev => ({
          ...prev,
          todaySubmissions: standupsData.length,
          todayTotal: activeMembers,
          issuesCount: standupsData.filter(s => s.blockers).length
        }));
      }

      // Fetch all standups for the standups section
      if (activeSection === "standups") {
        const { data: allStandupsData } = await supabase
          .from("daily_standups")
          .select("*")
          .is("deleted_at", null)
          .order("submitted_at", { ascending: false })
          .limit(100);

        if (allStandupsData) setStandups(allStandupsData);
      }

      // Fetch audit logs
      if (activeSection === "audit") {
        const { data: logsData } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (logsData) setAuditLogs(logsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  // Helper function to generate random password
  const generateRandomPassword = (length = 12) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddUser = async () => {
    try {
      setCreatingUser(true);

      // Validation
      if (!newUserForm.email || !newUserForm.full_name) {
        toast.error("Email and full name are required");
        return;
      }

      if (!newUserForm.department_id && newUserForm.role !== "superadmin") {
        toast.error("Department is required for members and managers");
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUserForm.email)) {
        toast.error("Please enter a valid email address");
        return;
      }

      // Password validation if provided
      if (newUserForm.password && newUserForm.password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", newUserForm.email)
        .single();

      if (existingUser) {
        toast.error("This email is already registered");
        return;
      }

      // Generate password if not provided
      const password = newUserForm.password || generateRandomPassword(12);
      const wasGenerated = !newUserForm.password;

      console.log("⚠️ Service role key in use - ensure this is only accessible by superadmins");

      // 1. Create auth user using admin client
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newUserForm.email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: newUserForm.full_name,
          role: newUserForm.role,
          department_id: newUserForm.department_id || null
        }
      });

      if (authError) {
        throw authError;
      }

      // 2. Verify profile was created (should happen via trigger)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.user.id)
        .single();

      if (!profile) {
        // If trigger didn't create profile, create manually
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: authUser.user.id,
            email: newUserForm.email,
            full_name: newUserForm.full_name,
            role: newUserForm.role,
            department_id: newUserForm.department_id || null,
            is_active: true
          });

        if (insertError) throw insertError;
      }

      // 3. Get department name for audit log
      let departmentName = "N/A";
      if (newUserForm.department_id) {
        const dept = departments.find(d => d.id === newUserForm.department_id);
        if (dept) departmentName = dept.name;
      }

      // 4. Log in audit logs
      await supabase.from("audit_logs").insert({
        actor_id: user?.id || "",
        action: "created",
        target_type: "user",
        target_id: authUser.user.id,
        new_values: {
          email: newUserForm.email,
          full_name: newUserForm.full_name,
          role: newUserForm.role,
          department: departmentName
        } as any
      });

      // 5. Show success message
      if (wasGenerated) {
        setGeneratedPassword(password);
        toast.success(
          `User created successfully! ${newUserForm.send_invite ? 'Invitation email sent.' : ''}`,
          { duration: 10000 }
        );
      } else {
        toast.success(
          `User created successfully! ${newUserForm.send_invite ? 'Invitation email sent.' : ''}`
        );
      }

      // 6. Refresh user list
      fetchAllData();

      // 7. Reset form but keep modal open if password was generated
      if (wasGenerated) {
        // Keep modal open to show generated password
      } else {
        setAddUserModal(false);
        setNewUserForm({
          email: "",
          full_name: "",
          role: "member",
          department_id: "",
          password: "",
          send_invite: true
        });
      }

    } catch (error: any) {
      console.error("Error creating user:", error);

      // Specific error messages
      if (error.message?.includes("already registered")) {
        toast.error("This email is already registered");
      } else if (error.message?.includes("permission")) {
        toast.error("You don't have permission to create users");
      } else if (error.message?.includes("network")) {
        toast.error("Network error. Please try again");
      } else {
        toast.error(error.message || "Failed to create user");
      }
    } finally {
      setCreatingUser(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editUserForm.full_name,
          role: editUserForm.role,
          is_active: editUserForm.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Log the action
      await supabase.from("audit_logs").insert({
        action: "updated",
        target_type: "user",
        target_id: selectedUser.id,
        actor_id: user?.id || "",
        old_values: selectedUser as any,
        new_values: editUserForm as any,
        metadata: { updated_fields: ["full_name", "role", "is_active"] } as any
      });

      toast.success("User updated successfully");
      setEditUserModal(false);
      fetchAllData();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const handleTransferUser = async () => {
    if (!selectedUser) return;

    try {
      if (!transferForm.new_department_id || !transferForm.reason) {
        toast.error("Please select new department and provide reason");
        return;
      }

      const oldDeptId = selectedUser.department_id;

      const { error } = await supabase
        .from("profiles")
        .update({
          department_id: transferForm.new_department_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Log the transfer
      await supabase.from("audit_logs").insert({
        action: "transferred",
        target_type: "user",
        target_id: selectedUser.id,
        actor_id: user?.id || "",
        old_values: { department_id: oldDeptId } as any,
        new_values: { department_id: transferForm.new_department_id } as any,
        metadata: {
          reason: transferForm.reason,
          notifications: {
            user: transferForm.notify_user,
            old_manager: transferForm.notify_old_manager,
            new_manager: transferForm.notify_new_manager
          }
        } as any
      });

      toast.success("User transferred successfully");
      setTransferModal(false);
      setTransferForm({
        new_department_id: "",
        reason: "",
        notify_user: true,
        notify_old_manager: true,
        notify_new_manager: true
      });
      fetchAllData();
    } catch (error) {
      console.error("Error transferring user:", error);
      toast.error("Failed to transfer user");
    }
  };

  const handleDeactivateUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Log the action
      await supabase.from("audit_logs").insert({
        action: "soft_deleted",
        target_type: "user",
        target_id: selectedUser.id,
        actor_id: user?.id || "",
        metadata: { deleted_at: new Date().toISOString() } as any
      });

      toast.success("User deactivated successfully");
      setDeactivateModal(false);
      fetchAllData();
    } catch (error) {
      console.error("Error deactivating user:", error);
      toast.error("Failed to deactivate user");
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: true,
          deleted_at: null,
          deleted_by: null
        })
        .eq("id", userId);

      if (error) throw error;

      // Log the action
      await supabase.from("audit_logs").insert({
        action: "restored",
        target_type: "user",
        target_id: userId,
        actor_id: user?.id || "",
        metadata: { restored_at: new Date().toISOString() } as any
      });

      toast.success("User restored successfully");
      fetchAllData();
    } catch (error) {
      console.error("Error restoring user:", error);
      toast.error("Failed to restore user");
    }
  };

  const handleViewHistory = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("daily_standups")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (data) {
        setUserHistory(data);
        setViewHistoryModal(true);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load user history");
    }
  };

  const handleAddDepartment = async () => {
    try {
      if (!newDeptForm.name) {
        toast.error("Department name is required");
        return;
      }

      const { error } = await supabase
        .from("departments")
        .insert({
          name: newDeptForm.name,
          description: newDeptForm.description
        });

      if (error) throw error;

      toast.success("Department created successfully");
      setAddDeptModal(false);
      setNewDeptForm({ name: "", description: "" });
      fetchAllData();
    } catch (error) {
      console.error("Error adding department:", error);
      toast.error("Failed to create department");
    }
  };

  const handleEditDepartment = async () => {
    if (!selectedDept) return;

    try {
      const { error } = await supabase
        .from("departments")
        .update({
          name: newDeptForm.name,
          description: newDeptForm.description,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedDept.id);

      if (error) throw error;

      toast.success("Department updated successfully");
      setEditDeptModal(false);
      fetchAllData();
    } catch (error) {
      console.error("Error updating department:", error);
      toast.error("Failed to update department");
    }
  };

  const openEditModal = (userToEdit: Profile) => {
    setSelectedUser(userToEdit);
    setEditUserForm({
      full_name: userToEdit.full_name,
      role: userToEdit.role,
      is_active: userToEdit.is_active
    });
    setEditUserModal(true);
  };

  const openTransferModal = (userToTransfer: Profile) => {
    setSelectedUser(userToTransfer);
    setTransferForm({
      new_department_id: "",
      reason: "",
      notify_user: true,
      notify_old_manager: true,
      notify_new_manager: true
    });
    setTransferModal(true);
  };

  const openDeactivateModal = (userToDeactivate: Profile) => {
    setSelectedUser(userToDeactivate);
    setDeactivateModal(true);
  };

  const openEditDeptModal = (dept: Department) => {
    setSelectedDept(dept);
    setNewDeptForm({
      name: dept.name,
      description: dept.description || ""
    });
    setEditDeptModal(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "superadmin": return "destructive";
      case "manager": return "default";
      case "member": return "secondary";
      default: return "outline";
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter;
    const matchesDept = userDeptFilter === "all" || u.department_id === userDeptFilter;
    const matchesStatus = userStatusFilter === "all" ||
      (userStatusFilter === "active" && !u.deleted_at) ||
      (userStatusFilter === "inactive" && u.deleted_at);
    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        {/* Sidebar */}
        <Sidebar className="border-r">
          <SidebarContent>
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <div>
                  <div className="font-bold text-sm">Superadmin</div>
                  <div className="text-xs text-muted-foreground">{user?.full_name}</div>
                </div>
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("overview")}
                      isActive={activeSection === "overview"}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Overview</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("users")}
                      isActive={activeSection === "users"}
                    >
                      <Users className="w-4 h-4" />
                      <span>All Users</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("departments")}
                      isActive={activeSection === "departments"}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Departments</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("standups")}
                      isActive={activeSection === "standups"}
                    >
                      <FileText className="w-4 h-4" />
                      <span>All Standups</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("transfers")}
                      isActive={activeSection === "transfers"}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>Transfers</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("audit")}
                      isActive={activeSection === "audit"}
                    >
                      <ScrollText className="w-4 h-4" />
                      <span>Audit Logs</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate("/task-submissions")}
                      isActive={false}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Task Submissions</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("settings")}
                      isActive={activeSection === "settings"}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="border-b bg-card">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">Superadmin Dashboard</h1>
                  <Badge variant="destructive">SUPERADMIN</Badge>
                </div>
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-auto p-6">
            {activeSection === "overview" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">System Overview</h2>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground">
                        Members: {stats.totalMembers}, Managers: {stats.totalManagers}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Departments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalDepartments}</div>
                      <p className="text-xs text-muted-foreground">Active departments</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Today's Submissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.todaySubmissions}/{stats.todayTotal}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats.todayTotal > 0
                          ? `${Math.round((stats.todaySubmissions / stats.todayTotal) * 100)}%`
                          : "0%"
                        }
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.issuesCount}</div>
                      <p className="text-xs text-muted-foreground">Members with blockers</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Department Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Department Breakdown</CardTitle>
                    <CardDescription>Overview of all departments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Department</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Today's Submissions</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departments.map(dept => {
                          const deptMembers = allUsers.filter(u => u.department_id === dept.id && !u.deleted_at);
                          return (
                            <TableRow key={dept.id}>
                              <TableCell className="font-medium">{dept.name}</TableCell>
                              <TableCell>{deptMembers.length}</TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>
                                <Badge variant="outline">Active</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Team Daily Tasks */}
                <AllUserTodos />
              </div>
            )}

            {activeSection === "users" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">All Users</h2>
                  <Button onClick={() => setAddUserModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add New User
                  </Button>
                </div>

                {/* Filters */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>

                      <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="member">Members</SelectItem>
                          <SelectItem value="manager">Managers</SelectItem>
                          <SelectItem value="superadmin">Superadmins</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={userDeptFilter} onValueChange={setUserDeptFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Users Table */}
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map(u => {
                          const dept = departments.find(d => d.id === u.department_id);
                          return (
                            <TableRow key={u.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>{getInitials(u.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">{u.full_name}</span>
                                </div>
                              </TableCell>
                              <TableCell>{u.email}</TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeColor(u.role)}>
                                  {u.role}
                                </Badge>
                              </TableCell>
                              <TableCell>{dept?.name || "N/A"}</TableCell>
                              <TableCell>
                                {u.deleted_at ? (
                                  <Badge variant="outline" className="bg-destructive/10">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Inactive
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-green-500/10">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditModal(u)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewHistory(u.id)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openTransferModal(u)}
                                  >
                                    <ArrowLeftRight className="w-4 h-4" />
                                  </Button>
                                  {u.deleted_at ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRestoreUser(u.id)}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeactivateModal(u)}
                                    >
                                      <UserX className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "departments" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Departments</h2>
                  <Button onClick={() => setAddDeptModal(true)}>
                    <Building2 className="w-4 h-4 mr-2" />
                    Create New Department
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {departments.map(dept => {
                    const deptMembers = allUsers.filter(u => u.department_id === dept.id && !u.deleted_at);
                    const manager = deptMembers.find(u => u.role === "manager");

                    return (
                      <Card key={dept.id}>
                        <CardHeader>
                          <CardTitle>{dept.name}</CardTitle>
                          <CardDescription>{dept.description || "No description"}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Manager: </span>
                            <span className="font-medium">
                              {manager ? manager.full_name : "No manager assigned"}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Members: </span>
                            <span className="font-medium">{deptMembers.length} active</span>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDeptModal(dept)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === "standups" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">All Standups</h2>

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Standups view - Implementation in progress
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "transfers" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Transfer History</h2>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transfers</CardTitle>
                    <CardDescription>Department transfers across the system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Transfer history view - Implementation in progress
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "audit" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Audit Logs</h2>

                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Target Type</TableHead>
                          <TableHead>Actor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map(log => {
                          const actor = allUsers.find(u => u.id === log.actor_id);
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.action}</Badge>
                              </TableCell>
                              <TableCell>{log.target_type}</TableCell>
                              <TableCell>{actor?.full_name || "Unknown"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "settings" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Settings</h2>

                <Card>
                  <CardHeader>
                    <CardTitle>System Settings</CardTitle>
                    <CardDescription>Configure system-wide settings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Settings page - Implementation in progress
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add User Modal */}
      <Dialog open={addUserModal} onOpenChange={(open) => {
        setAddUserModal(open);
        if (!open) {
          // Reset form when closing
          setNewUserForm({
            email: "",
            full_name: "",
            role: "member",
            department_id: "",
            password: "",
            send_invite: true
          });
          setGeneratedPassword("");
          setShowPassword(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account and send invitation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="user@example.com"
                disabled={creatingUser}
              />
            </div>
            <div>
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                placeholder="John Doe"
                disabled={creatingUser}
              />
            </div>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value: any) => setNewUserForm({ ...newUserForm, role: value })}
                disabled={creatingUser}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newUserForm.role !== "superadmin" && (
              <div>
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={newUserForm.department_id}
                  onValueChange={(value) => setNewUserForm({ ...newUserForm, department_id: value })}
                  disabled={creatingUser}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="password">
                Password (optional)
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="Leave empty to auto-generate"
                  disabled={creatingUser}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={creatingUser}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Min. 8 characters. If empty, a random password will be generated.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send_invite"
                checked={newUserForm.send_invite}
                onCheckedChange={(checked) =>
                  setNewUserForm({ ...newUserForm, send_invite: checked as boolean })
                }
                disabled={creatingUser}
              />
              <Label
                htmlFor="send_invite"
                className="text-sm font-normal cursor-pointer"
              >
                Send invitation email
              </Label>
            </div>

            {generatedPassword && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm font-medium mb-2">Temporary Password Generated:</p>
                <div className="bg-background p-2 rounded border font-mono text-sm break-all">
                  {generatedPassword}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ Share this password with the user. They should change it after first login.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddUserModal(false)}
              disabled={creatingUser}
            >
              {generatedPassword ? "Close" : "Cancel"}
            </Button>
            {!generatedPassword && (
              <Button onClick={handleAddUser} disabled={creatingUser}>
                {creatingUser ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating user...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editUserModal} onOpenChange={setEditUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input
                id="edit_full_name"
                value={editUserForm.full_name}
                onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_email">Email (read-only)</Label>
              <Input
                id="edit_email"
                value={selectedUser?.email || ""}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed. Create new account if needed.
              </p>
            </div>
            <div>
              <Label htmlFor="edit_role">Role</Label>
              <Select
                value={editUserForm.role}
                onValueChange={(value: any) => setEditUserForm({ ...editUserForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_active"
                checked={editUserForm.is_active}
                onChange={(e) => setEditUserForm({ ...editUserForm, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit_active">Active Status</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserModal(false)}>Cancel</Button>
            <Button onClick={handleEditUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer User Modal */}
      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer User</DialogTitle>
            <DialogDescription>
              Move user to a different department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ This will transfer all historical standups to the new department's manager visibility
              </p>
            </div>
            <div>
              <Label>Current Department</Label>
              <Input
                value={departments.find(d => d.id === selectedUser?.department_id)?.name || ""}
                disabled
              />
            </div>
            <div>
              <Label htmlFor="new_department">New Department *</Label>
              <Select
                value={transferForm.new_department_id}
                onValueChange={(value) => setTransferForm({ ...transferForm, new_department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new department" />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter(d => d.id !== selectedUser?.department_id)
                    .map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transfer_reason">Reason *</Label>
              <Textarea
                id="transfer_reason"
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                placeholder="Explain why this user is being transferred..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notifications</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="notify_user"
                  checked={transferForm.notify_user}
                  onChange={(e) => setTransferForm({ ...transferForm, notify_user: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="notify_user" className="font-normal">Notify user</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="notify_old"
                  checked={transferForm.notify_old_manager}
                  onChange={(e) => setTransferForm({ ...transferForm, notify_old_manager: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="notify_old" className="font-normal">Notify old manager</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="notify_new"
                  checked={transferForm.notify_new_manager}
                  onChange={(e) => setTransferForm({ ...transferForm, notify_new_manager: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="notify_new" className="font-normal">Notify new manager</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModal(false)}>Cancel</Button>
            <Button onClick={handleTransferUser}>Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate User Modal */}
      <Dialog open={deactivateModal} onOpenChange={setDeactivateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {selectedUser?.full_name}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm">
                They will no longer be able to submit standups or access the system.
              </p>
              <p className="text-sm mt-2">
                Historical data will be preserved and the user can be restored later.
              </p>
            </div>
            {selectedUser && (
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Role:</span> {selectedUser.role}</div>
                <div><span className="font-medium">Department:</span> {departments.find(d => d.id === selectedUser.department_id)?.name}</div>
                <div><span className="font-medium">Joined:</span> {new Date(selectedUser.created_at).toLocaleDateString()}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivateUser}>
              Confirm Deactivation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View History Modal */}
      <Dialog open={viewHistoryModal} onOpenChange={setViewHistoryModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Standup History</DialogTitle>
            <DialogDescription>
              Complete submission history for {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[500px] overflow-auto">
            <div className="space-y-4">
              {userHistory.map(standup => (
                <Card key={standup.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {new Date(standup.date).toLocaleDateString()}
                      </CardTitle>
                      <Badge variant="outline">{standup.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div>
                      <span className="font-medium">Yesterday: </span>
                      {standup.yesterday_work}
                    </div>
                    <div>
                      <span className="font-medium">Today: </span>
                      {standup.today_plan}
                    </div>
                    {standup.blockers && (
                      <div>
                        <span className="font-medium text-destructive">Blockers: </span>
                        {standup.blockers}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {userHistory.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No submission history found
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewHistoryModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Department Modal */}
      <Dialog open={addDeptModal} onOpenChange={setAddDeptModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Department</DialogTitle>
            <DialogDescription>Add a new department to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept_name">Department Name *</Label>
              <Input
                id="dept_name"
                value={newDeptForm.name}
                onChange={(e) => setNewDeptForm({ ...newDeptForm, name: e.target.value })}
                placeholder="e.g., Engineering, Sales"
              />
            </div>
            <div>
              <Label htmlFor="dept_description">Description</Label>
              <Textarea
                id="dept_description"
                value={newDeptForm.description}
                onChange={(e) => setNewDeptForm({ ...newDeptForm, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeptModal(false)}>Cancel</Button>
            <Button onClick={handleAddDepartment}>Create Department</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Modal */}
      <Dialog open={editDeptModal} onOpenChange={setEditDeptModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_dept_name">Department Name</Label>
              <Input
                id="edit_dept_name"
                value={newDeptForm.name}
                onChange={(e) => setNewDeptForm({ ...newDeptForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_dept_description">Description</Label>
              <Textarea
                id="edit_dept_description"
                value={newDeptForm.description}
                onChange={(e) => setNewDeptForm({ ...newDeptForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDeptModal(false)}>Cancel</Button>
            <Button onClick={handleEditDepartment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default AdminDashboard;
