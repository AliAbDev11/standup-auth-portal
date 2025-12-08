import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ListTodo } from "lucide-react";

interface Todo {
    id: string;
    user_id: string;
    date: string;
    task_text: string;
    is_completed: boolean;
    position: number;
    created_at: string;
}

export function DailyTodoList() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTask, setNewTask] = useState("");
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchTodos();
    }, []);

    async function fetchTodos() {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from("daily_todos" as any)
                .select("*")
                .eq("user_id", user.id)
                .eq("date", today)
                .order("position") as any;

            if (error) throw error;
            setTodos((data as Todo[]) || []);
        } catch (error) {
            console.error("Error fetching todos:", error);
            toast.error("Failed to load todos");
        } finally {
            setLoading(false);
        }
    }

    async function addTodo() {
        if (!newTask.trim()) {
            toast.error("Please enter a task");
            return;
        }

        if (todos.length >= 5) {
            toast.error("Maximum 5 tasks per day");
            return;
        }

        setAdding(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("You must be logged in");
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const nextPosition = todos.length + 1;

            const { error } = await supabase
                .from("daily_todos" as any)
                .insert({
                    user_id: user.id,
                    date: today,
                    task_text: newTask.trim(),
                    position: nextPosition,
                    is_completed: false,
                }) as any;

            if (error) throw error;

            toast.success("Task added!");
            setNewTask("");
            await fetchTodos();
        } catch (error) {
            console.error("Error adding todo:", error);
            toast.error("Failed to add task");
        } finally {
            setAdding(false);
        }
    }

    async function toggleTodo(todo: Todo) {
        try {
            const { error } = await supabase
                .from("daily_todos" as any)
                .update({ is_completed: !todo.is_completed })
                .eq("id", todo.id) as any;

            if (error) throw error;

            setTodos(todos.map(t =>
                t.id === todo.id ? { ...t, is_completed: !t.is_completed } : t
            ));
        } catch (error) {
            console.error("Error toggling todo:", error);
            toast.error("Failed to update task");
        }
    }

    async function deleteTodo(id: string) {
        try {
            const { error } = await supabase
                .from("daily_todos" as any)
                .delete()
                .eq("id", id) as any;

            if (error) throw error;

            toast.success("Task deleted");
            await fetchTodos();
        } catch (error) {
            console.error("Error deleting todo:", error);
            toast.error("Failed to delete task");
        }
    }

    const completedCount = todos.filter(t => t.is_completed).length;

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ListTodo className="w-5 h-5" />
                            Today's Top 5 Tasks
                        </CardTitle>
                        <CardDescription>
                            Plan your day - {completedCount} of {todos.length} completed
                        </CardDescription>
                    </div>
                    {todos.length > 0 && (
                        <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                                {todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0}%
                            </div>
                            <div className="text-xs text-muted-foreground">Complete</div>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress Bar */}
                {todos.length > 0 && (
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${(completedCount / todos.length) * 100}%` }}
                        />
                    </div>
                )}

                {/* Todo List */}
                <div className="space-y-2">
                    {todos.map((todo, index) => (
                        <div
                            key={todo.id}
                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <Checkbox
                                checked={todo.is_completed}
                                onCheckedChange={() => toggleTodo(todo)}
                                className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                    <span className="font-medium text-muted-foreground mr-2">#{index + 1}</span>
                                    {todo.task_text}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTodo(todo.id)}
                                className="text-destructive hover:text-destructive"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {todos.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No tasks yet. Add your top 5 tasks for today!</p>
                    </div>
                )}

                {/* Add New Task */}
                {todos.length < 5 && (
                    <div className="flex gap-2 pt-2">
                        <Input
                            placeholder="Add a new task..."
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                            disabled={adding}
                            className="flex-1"
                        />
                        <Button onClick={addTodo} disabled={adding || !newTask.trim()}>
                            {adding ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {todos.length >= 5 && (
                    <p className="text-xs text-center text-muted-foreground">
                        Maximum 5 tasks reached. Complete or delete tasks to add more.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
