import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Circle, ListTodo } from "lucide-react";
import { toast } from "sonner";

interface Todo {
    id: string;
    user_id: string;
    date: string;
    task_text: string;
    is_completed: boolean;
    position: number;
    created_at: string;
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
    department_id: string;
    departments?: {
        name: string;
    };
}

interface UserTodos {
    profile: Profile;
    todos: Todo[];
    completedCount: number;
    totalCount: number;
}

export function AllUserTodos() {
    const [loading, setLoading] = useState(true);
    const [userTodos, setUserTodos] = useState<UserTodos[]>([]);

    useEffect(() => {
        fetchAllTodos();
    }, []);

    async function fetchAllTodos() {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];

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

            // Fetch all todos for today
            const { data: todos, error: todosError } = await supabase
                .from("daily_todos" as any)
                .select("*")
                .eq("date", today)
                .order("position") as any;

            if (todosError) throw todosError;

            // Group todos by user
            const todosByUser = new Map<string, Todo[]>();
            (todos as Todo[] || []).forEach((todo: Todo) => {
                if (!todosByUser.has(todo.user_id)) {
                    todosByUser.set(todo.user_id, []);
                }
                todosByUser.get(todo.user_id)!.push(todo);
            });

            // Combine data
            const combined: UserTodos[] = (profiles || [])
                .map((profile) => {
                    const userTodoList = todosByUser.get(profile.id) || [];
                    const completedCount = userTodoList.filter(t => t.is_completed).length;

                    return {
                        profile: profile as Profile,
                        todos: userTodoList,
                        completedCount,
                        totalCount: userTodoList.length,
                    };
                })
                .filter(ut => ut.totalCount > 0); // Only show users with todos

            setUserTodos(combined);
        } catch (error: any) {
            console.error("Error fetching todos:", error);
            toast.error("Failed to load todos");
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

    if (userTodos.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListTodo className="w-5 h-5" />
                        Team Daily Tasks
                    </CardTitle>
                    <CardDescription>View all team members' daily tasks</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No tasks created today</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ListTodo className="w-5 h-5" />
                    Team Daily Tasks
                </CardTitle>
                <CardDescription>
                    {userTodos.length} members with tasks today
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {userTodos.map((ut) => (
                    <div key={ut.profile.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium">{ut.profile.full_name}</h4>
                                <p className="text-xs text-muted-foreground">
                                    {ut.profile.departments?.name || "No Department"} • {ut.profile.email}
                                </p>
                            </div>
                            <div className="text-right">
                                <Badge variant={ut.completedCount === ut.totalCount ? "default" : "secondary"}>
                                    {ut.completedCount}/{ut.totalCount} Done
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {ut.totalCount > 0 ? Math.round((ut.completedCount / ut.totalCount) * 100) : 0}%
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${ut.completedCount === ut.totalCount
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                        : 'bg-gradient-to-r from-blue-500 to-purple-500'
                                    }`}
                                style={{ width: `${ut.totalCount > 0 ? (ut.completedCount / ut.totalCount) * 100 : 0}%` }}
                            />
                        </div>

                        {/* Todo List */}
                        <div className="space-y-2">
                            {ut.todos.map((todo) => (
                                <div
                                    key={todo.id}
                                    className="flex items-start gap-2 text-sm"
                                >
                                    {todo.is_completed ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    )}
                                    <span className={todo.is_completed ? 'line-through text-muted-foreground' : ''}>
                                        <span className="font-medium text-muted-foreground">#{todo.position}</span> {todo.task_text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
