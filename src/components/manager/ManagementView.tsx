import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Edit, UserX } from "lucide-react";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  status: string;
}

interface ManagementViewProps {
  teamMembers: TeamMember[];
  onInvite: () => void;
  onEdit: (member: TeamMember) => void;
  onDeactivate: (memberId: string, memberName: string) => void;
}

export const ManagementView = ({ 
  teamMembers, 
  onInvite, 
  onEdit, 
  onDeactivate 
}: ManagementViewProps) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team Management</h2>
          <p className="text-sm text-muted-foreground">Manage your team members</p>
        </div>
        <Button onClick={onInvite} size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Team List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {teamMembers.map(member => (
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
                <div className="flex items-center gap-2 shrink-0">
                  <Badge 
                    variant={member.is_active ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {member.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(member)}
                    className="h-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  {member.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeactivate(member.id, member.full_name)}
                      className="h-8 text-destructive hover:text-destructive"
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
