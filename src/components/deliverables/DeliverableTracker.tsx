import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
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
    department?: {
        name: string;
    };
}

interface UserDeliverables {
    profile: Profile;
    deliverables: Map<number, Deliverable>;
    submittedCount: number;
    missingCount: number;
}

export function DeliverableTracker() {
    const [loading, setLoading] = useState(true);
    const [userDeliverables, setUserDeliverables] = useState<UserDeliverables[]>([]);
    const days = Array.from({ length: 26 }, (_, i) => i + 45);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);

            // Fetch all profiles
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select(`
          id,
          full_name,
          email,
          department_id,
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
                .from("deliverables")
                .select("*")
                .gte("day_number", 45)
                .lte("day_number", 70);

            if (deliverablesError) throw deliverablesError;

            // Group deliverables by user
            const deliverablesByUser = new Map<string, Map<number, Deliverable>>();
            deliverables?.forEach((d) => {
                if (!deliverablesByUser.has(d.user_id)) {
                    deliverablesByUser.set(d.user_id, new Map());
                }
                deliverablesByUser.get(d.user_id)!.set(d.day_number, d);
            });

            // Combine data
            const combined: UserDeliverables[] = (profiles || []).map((profile) => {
                const userDels = deliverablesByUser.get(profile.id) || new Map();
                return {
                    profile: profile as Profile,
                    deliverables: userDels,
                    submittedCount: userDels.size,
                    missingCount: 26 - userDels.size,
                };
            });

            setUserDeliverables(combined);
        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load deliverables");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Group by department
    const byDepartment = userDeliverables.reduce((acc, ud) => {
        const deptName = ud.profile.department?.name || "No Department";
        if (!acc[deptName]) acc[deptName] = [];
        acc[deptName].push(ud);
        return acc;
    }, {} as Record<string, UserDeliverables[]>);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Deliverable Tracker</h2>
                    <p className="text-muted-foreground">Days 45-70 submission status by squad</p>
                </div>
                <Badge variant="outline" className="text-sm">
                    {userDeliverables.reduce((sum, ud) => sum + ud.submittedCount, 0)} / {userDeliverables.length * 26} Total Submissions
                </Badge>
            </div>

            {Object.entries(byDepartment).map(([deptName, users]) => (
                <Card key={deptName}>
                    <CardHeader>
                        <CardTitle className="text-lg">{deptName}</CardTitle>
                        <CardDescription>
                            {users.reduce((sum, u) => sum + u.submittedCount, 0)} / {users.length * 26} submissions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 font-medium sticky left-0 bg-card z-10">Member</th>
                                        <th className="text-center p-2 font-medium">Submitted</th>
                                        <th className="text-center p-2 font-medium">Missing</th>
                                        {days.map((day) => (
                                            <th key={day} className="text-center p-2 font-medium min-w-[40px]">
                                                {day}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((ud) => (
                                        <tr key={ud.profile.id} className="border-b hover:bg-muted/50">
                                            <td className="p-2 sticky left-0 bg-card z-10">
                                                <div>
                                                    <div className="font-medium">{ud.profile.full_name}</div>
                                                    <div className="text-xs text-muted-foreground">{ud.profile.email}</div>
                                                </div>
                                            </td>
                                            <td className="text-center p-2">
                                                <Badge variant="default" className="bg-green-600">
                                                    {ud.submittedCount}
                                                </Badge>
                                            </td>
                                            <td className="text-center p-2">
                                                <Badge variant="destructive">
                                                    {ud.missingCount}
                                                </Badge>
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
                                                                className="inline-flex items-center justify-center"
                                                                title={`View Day ${day} deliverable`}
                                                            >
                                                                <CheckCircle2 className="h-5 w-5 text-green-600 hover:text-green-700" />
                                                            </a>
                                                        ) : (
                                                            <XCircle className="h-5 w-5 text-red-400 mx-auto" />
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
        </div>
    );
}
