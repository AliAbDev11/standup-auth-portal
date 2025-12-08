import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

const formSchema = z.object({
    dayNumber: z.string().refine((val) => {
        const num = parseInt(val);
        return num >= 45 && num <= 70;
    }, "Day number must be between 45 and 70"),
    driveLink: z.string().url("Please enter a valid URL"),
    linkedinLink: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    notes: z.string().optional(),
    agreed: z.boolean().refine((val) => val === true, {
        message: "You must confirm that you have followed the instructions",
    }),
});

export function DeliverableForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            dayNumber: "",
            driveLink: "",
            linkedinLink: "",
            notes: "",
            agreed: false,
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error("You must be logged in to submit deliverables");
                return;
            }

            const { error } = await supabase.from("deliverables").insert({
                user_id: user.id,
                day_number: parseInt(values.dayNumber),
                drive_link: values.driveLink,
                linkedin_link: values.linkedinLink || null,
                notes: values.notes || null,
            });

            if (error) {
                if (error.code === "23505") {
                    toast.error(`You have already submitted a deliverable for Day ${values.dayNumber}`);
                } else {
                    console.error("Submission error:", error);
                    toast.error("Failed to submit deliverable. Please try again.");
                }
                return;
            }

            toast.success(`Deliverable for Day ${values.dayNumber} submitted successfully!`);
            form.reset();
        } catch (error) {
            console.error("Error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    }

    const days = Array.from({ length: 26 }, (_, i) => i + 45);

    return (
        <Card className="w-full">
            <CardHeader className="pb-4">
                <CardTitle className="text-xl">Submit Daily Deliverable</CardTitle>
                <CardDescription>Submit your work for Days 45-70</CardDescription>
            </CardHeader>
            <CardContent>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="dayNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">Day Number *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Select day number" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {days.map((day) => (
                                                <SelectItem key={day} value={day.toString()}>
                                                    Day {day}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="driveLink"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">Link to Daily Deliverables Google Drive Folder *</FormLabel>
                                    <FormDescription className="text-xs text-muted-foreground space-y-1 mb-2">
                                        <div>1. Create a single folder named "Day X - Your Full Name"</div>
                                        <div>2. Add all deliverables (Design, Workflow, Video, etc.)</div>
                                        <div>3. Set sharing to "Anyone with the link can view"</div>
                                        <div>4. Paste the link below</div>
                                    </FormDescription>
                                    <FormControl>
                                        <Input placeholder="https://drive.google.com/..." className="h-11" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="linkedinLink"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">Link to Live LinkedIn Post (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://linkedin.com/posts/..." className="h-11" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">Notes or Comments (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Any additional context..."
                                            className="resize-none min-h-[80px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="agreed"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/50">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="text-sm font-normal">
                                            I confirm that I have placed all required deliverables into a single Google Drive folder, named it correctly, and set the sharing permissions to "Anyone with the link can view".
                                        </FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit Deliverable
                                </>
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
