import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Eye, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

interface TeamStatusViewProps {
  teamMembers: TeamMember[];
  onViewStandup: (userId: string) => void;
}

export const TeamStatusView = ({ teamMembers, onViewStandup }: TeamStatusViewProps) => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const filteredMembers = teamMembers.filter(member => {
    if (filter !== "all" && member.status !== filter) return false;
    if (searchQuery && !member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !member.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filterOptions: { value: FilterType; label: string; count: number }[] = [
    { value: "all", label: "All", count: teamMembers.length },
    { value: "submitted", label: "Submitted", count: teamMembers.filter(m => m.status === "submitted").length },
    { value: "pending", label: "Pending", count: teamMembers.filter(m => m.status === "pending").length },
    { value: "missed", label: "Missed", count: teamMembers.filter(m => m.status === "missed").length },
    { value: "on_leave", label: "On Leave", count: teamMembers.filter(m => m.status === "on_leave").length },
  ];

  const getStatusBadge = (status: string, submittedAt: string | null) => {
    switch (status) {
      case "submitted":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-success))]" />
            <span className="text-xs text-muted-foreground">
              Submitted {submittedAt ? `at ${formatTime(submittedAt)}` : ''}
            </span>
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-warning))]" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
        );
      case "missed":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-danger))]" />
            <span className="text-xs text-muted-foreground">Missed</span>
          </div>
        );
      case "on_leave":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-info))]" />
            <span className="text-xs text-muted-foreground">On Leave</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Team Status</h2>
          <p className="text-sm text-muted-foreground">Today's standup submissions</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(option.value)}
            className="shrink-0"
          >
            {option.label}
            <Badge variant="secondary" className="ml-2 text-xs">
              {option.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Team List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No team members found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredMembers.map(member => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(member.status, member.submitted_at)}
                    {member.status === "submitted" && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => onViewStandup(member.id)}
                        className="h-8"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
