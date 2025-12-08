import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ExternalLink, Calendar } from "lucide-react";
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

export function MyDeliverableStatus() {
    const [loading, setLoading] = useState(true);
    const [deliverables, setDeliverables] = useState<Map<number, Deliverable>>(new Map());
    const days = Array.from({ length: 26 }, (_, i) => i + 45);

    useEffect(() => {
        fetchMyDeliverables();
    }, []);

    async function fetchMyDeliverables() {
        try {
            setLoading(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("You must be logged in");
                return;
            }

            // Fetch user's deliverables
            const { data, error } = await supabase
                .from("deliverables")
                .select("*")
                .eq("user_id", user.id)
                .gte("day_number", 45)
                .lte("day_number", 70)
                .order("day_number");

            if (error) throw error;

            // Convert to Map for easy lookup
            const delMap = new Map<number, Deliverable>();
            data?.forEach((d) => {
                delMap.set(d.day_number, d);
            });

            setDeliverables(delMap);
        } catch (error: any) {
            console.error("Error fetching deliverables:", error);
            toast.error("Failed to load your deliverables");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    const submittedCount = deliverables.size;
    const missingCount = 26 - submittedCount;
    const completionPercentage = Math.round((submittedCount / 26) * 100);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            My Deliverable Submissions
                        </CardTitle>
                        <CardDescription>Track your daily deliverable submissions (Days 45-70)</CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-primary">{completionPercentage}%</div>
                        <div className="text-sm text-muted-foreground">Complete</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{submittedCount}</div>
                        <div className="text-sm text-muted-foreground">Submitted</div>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{missingCount}</div>
                        <div className="text-sm text-muted-foreground">Missing</div>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold">26</div>
                        <div className="text-sm text-muted-foreground">Total Days</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Progress</span>
                        <span className="text-muted-foreground">{submittedCount} / 26 days</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Day Grid */}
                <div>
                    <h3 className="text-sm font-medium mb-3">Submission Status by Day</h3>
                    <div className="grid grid-cols-13 gap-2">
                        {days.map((day) => {
                            const deliverable = deliverables.get(day);
                            return (
                                <div
                                    key={day}
                                    className="flex flex-col items-center gap-1"
                                    title={deliverable ? `Day ${day} - Submitted` : `Day ${day} - Not submitted`}
                                >
                                    <div className="text-xs font-medium text-muted-foreground">D{day}</div>
                                    {deliverable ? (
                                        <a
                                            href={deliverable.drive_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-green-100 hover:bg-green-200 transition-colors"
                                        >
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        </a>
                                    ) : (
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-red-50">
                                            <XCircle className="h-5 w-5 text-red-400" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Submissions */}
                {submittedCount > 0 && (
                    <div>
                        <h3 className="text-sm font-medium mb-3">Recent Submissions</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {Array.from(deliverables.values())
                                .sort((a, b) => b.day_number - a.day_number)
                                .slice(0, 5)
                                .map((del) => (
                                    <div
                                        key={del.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            <div>
                                                <div className="font-medium text-sm">Day {del.day_number}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(del.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {del.linkedin_link && (
                                                <a
                                                    href={del.linkedin_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    LinkedIn
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                            <a
                                                href={del.drive_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                            >
                                                View
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {submittedCount === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <XCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No deliverables submitted yet</p>
                        <p className="text-xs mt-1">Use the form below to submit your daily deliverables</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
