import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Loader2, CheckCircle2, XCircle, ExternalLink, LogOut,
    TrendingUp, TrendingDown, Users, Calendar, Award, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

interface Deliverable {
    id: string;
    user_id: string;
    day_number: number;
    drive_link: string;
    linkedin_link: string | null;
    notes: string | null;
    created_at: string;
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
    department_id: string;
    role: string;
    departments?: {
        name: string;
    };
}

interface UserDeliverables {
    profile: Profile;
    deliverables: Map<number, Deliverable>;
    submittedCount: number;
    missingCount: number;
    completionRate: number;
}

interface DepartmentStats {
    name: string;
    totalMembers: number;
    totalSubmissions: number;
    totalPossible: number;
    completionRate: number;
    users: UserDeliverables[];
}

export default function TaskSubmissionDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [userDeliverables, setUserDeliverables] = useState<UserDeliverables[]>([]);
    const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
    const days = Array.from({ length: 26 }, (_, i) => i + 45);

    useEffect(() => {
        checkUser();
    }, []);

    async function checkUser() {
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

            if (!profile || profile.role !== "superadmin") {
                toast.error("Access denied. Superadmin only.");
                navigate("/");
                return;
            }

            setUser(profile);
            await fetchData();
        } catch (error) {
            console.error("Error checking user:", error);
            navigate("/auth");
        }
    }

    async function fetchData() {
        try {
            setLoading(true);

            // Fetch all active profiles with departments
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select(`
          id,
          full_name,
          email,
          department_id,
          role,
          departments:department_id (
            name
          )
        `)
                .eq("is_active", true)
                .is("deleted_at", null)
                .order("full_name");

            if (profilesError) throw profilesError;

            // Fetch all deliverables
            const { data: deliverables, error: deliverablesError } = await supabase
                .from("deliverables" as any)
                .select("*")
                .gte("day_number", 45)
                .lte("day_number", 70) as any;

            if (deliverablesError) throw deliverablesError;

            // Group deliverables by user
            const deliverablesByUser = new Map<string, Map<number, Deliverable>>();
            (deliverables as Deliverable[] || []).forEach((d: Deliverable) => {
                if (!deliverablesByUser.has(d.user_id)) {
                    deliverablesByUser.set(d.user_id, new Map());
                }
                deliverablesByUser.get(d.user_id)!.set(d.day_number, d);
            });

            // Combine data
            const combined: UserDeliverables[] = (profiles || []).map((profile) => {
                const userDels = deliverablesByUser.get(profile.id) || new Map();
                const submittedCount = userDels.size;
                const missingCount = 26 - submittedCount;
                const completionRate = Math.round((submittedCount / 26) * 100);

                return {
                    profile: profile as Profile,
                    deliverables: userDels,
                    submittedCount,
                    missingCount,
                    completionRate,
                };
            });

            setUserDeliverables(combined);

            // Calculate department statistics
            const deptMap = new Map<string, UserDeliverables[]>();
            combined.forEach((ud) => {
                const deptName = ud.profile.departments?.name || "No Department";
                if (!deptMap.has(deptName)) {
                    deptMap.set(deptName, []);
                }
                deptMap.get(deptName)!.push(ud);
            });

            const deptStats: DepartmentStats[] = Array.from(deptMap.entries()).map(([name, users]) => {
                const totalMembers = users.length;
                const totalSubmissions = users.reduce((sum, u) => sum + u.submittedCount, 0);
                const totalPossible = totalMembers * 26;
                const completionRate = totalPossible > 0 ? Math.round((totalSubmissions / totalPossible) * 100) : 0;

                return {
                    name,
                    totalMembers,
                    totalSubmissions,
                    totalPossible,
                    completionRate,
                    users,
                };
            });

            setDepartmentStats(deptStats.sort((a, b) => b.completionRate - a.completionRate));
        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load task submissions");
        } finally {
            setLoading(false);
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success("Logged out successfully");
        navigate("/auth");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const totalUsers = userDeliverables.length;
    const totalSubmissions = userDeliverables.reduce((sum, u) => sum + u.submittedCount, 0);
    const totalPossible = totalUsers * 26;
    const overallCompletionRate = totalPossible > 0 ? Math.round((totalSubmissions / totalPossible) * 100) : 0;
    const usersCompleted = userDeliverables.filter(u => u.completionRate === 100).length;
    const usersAtRisk = userDeliverables.filter(u => u.completionRate < 50).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            {/* Header */}
            <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Task Submission Dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground">Days 45-70 Deliverable Tracking</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium">{user?.full_name}</p>
                            <Badge variant="destructive" className="text-xs">SUPERADMIN</Badge>
                        </div>
                        <Button onClick={handleLogout} variant="outline" size="sm">
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
                {/* KPI Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Total Participants
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{totalUsers}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Active members tracking
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Overall Completion
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-600">{overallCompletionRate}%</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {totalSubmissions} / {totalPossible} submissions
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Award className="w-4 h-4" />
                                Completed Users
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-purple-600">{usersCompleted}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                100% completion rate
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                At Risk
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">{usersAtRisk}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Below 50% completion
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Department Performance */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Squad Performance Overview
                        </CardTitle>
                        <CardDescription>Completion rates by department</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {departmentStats.map((dept) => (
                                <div key={dept.name} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                                            <span className="font-medium">{dept.name}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {dept.totalMembers} members
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-muted-foreground">
                                                {dept.totalSubmissions} / {dept.totalPossible}
                                            </span>
                                            <span className={`text-lg font-bold min-w-[60px] text-right ${dept.completionRate >= 80 ? 'text-green-600' :
                                                dept.completionRate >= 50 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>
                                                {dept.completionRate}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${dept.completionRate >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                                dept.completionRate >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                                    'bg-gradient-to-r from-red-500 to-rose-500'
                                                }`}
                                            style={{ width: `${dept.completionRate}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Detailed User Submissions by Squad */}
                {departmentStats.map((dept) => (
                    <Card key={dept.name} className="shadow-lg">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{dept.name}</CardTitle>
                                    <CardDescription>
                                        {dept.totalSubmissions} / {dept.totalPossible} submissions ({dept.completionRate}%)
                                    </CardDescription>
                                </div>
                                <Badge
                                    variant={dept.completionRate >= 80 ? "default" : "destructive"}
                                    className="text-sm"
                                >
                                    {dept.completionRate >= 80 ? (
                                        <><TrendingUp className="w-3 h-3 mr-1" /> On Track</>
                                    ) : (
                                        <><TrendingDown className="w-3 h-3 mr-1" /> Needs Attention</>
                                    )}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-3 font-medium sticky left-0 bg-card z-10">Member</th>
                                            <th className="text-center p-3 font-medium">Submitted</th>
                                            <th className="text-center p-3 font-medium">Missing</th>
                                            <th className="text-center p-3 font-medium">Rate</th>
                                            {days.map((day) => (
                                                <th key={day} className="text-center p-2 font-medium min-w-[40px]">
                                                    <div className="text-xs">D{day}</div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dept.users
                                            .sort((a, b) => b.completionRate - a.completionRate)
                                            .map((ud) => (
                                                <tr key={ud.profile.id} className="border-b hover:bg-muted/50 transition-colors">
                                                    <td className="p-3 sticky left-0 bg-card z-10">
                                                        <div>
                                                            <div className="font-medium">{ud.profile.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{ud.profile.email}</div>
                                                        </div>
                                                    </td>
                                                    <td className="text-center p-3">
                                                        <Badge variant="default" className="bg-green-600">
                                                            {ud.submittedCount}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-center p-3">
                                                        <Badge variant="destructive">
                                                            {ud.missingCount}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-center p-3">
                                                        <div className={`font-bold ${ud.completionRate >= 80 ? 'text-green-600' :
                                                            ud.completionRate >= 50 ? 'text-yellow-600' :
                                                                'text-red-600'
                                                            }`}>
                                                            {ud.completionRate}%
                                                        </div>
                                                    </td>
                                                    {days.map((day) => {
                                                        const deliverable = ud.deliverables.get(day);
                                                        return (
                                                            <td key={day} className="text-center p-2">
                                                                {deliverable ? (
                                                                    <a
                                                                        href={deliverable.drive_link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-colors"
                                                                        title={`View Day ${day} deliverable`}
                                                                    >
                                                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                                    </a>
                                                                ) : (
                                                                    <div className="inline-flex items-center justify-center w-8 h-8">
                                                                        <XCircle className="h-5 w-5 text-red-400 dark:text-red-500" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </main>
        </div>
    );
}
