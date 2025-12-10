import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Clock, CheckCircle2 } from "lucide-react";

interface ProjectsViewProps {
  user: any;
}

const ProjectsView = ({ user }: ProjectsViewProps) => {
  // Placeholder projects - in a real app, these would come from the database
  const projects = [
    { 
      id: 1, 
      name: "Daily Standup System", 
      status: "active", 
      description: "Team standup management and tracking",
      lastActivity: "Today"
    },
    { 
      id: 2, 
      name: "Q4 Planning", 
      status: "active", 
      description: "Quarterly planning and goal setting",
      lastActivity: "Yesterday"
    },
    { 
      id: 3, 
      name: "Documentation Update", 
      status: "completed", 
      description: "Update team documentation",
      lastActivity: "3 days ago"
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Projects</h2>
        <p className="text-muted-foreground">Your assigned projects and tasks</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                {project.status === "active" ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                    Active
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    Completed
                  </span>
                )}
              </div>
              <CardTitle className="text-base mt-3">{project.name}</CardTitle>
              <CardDescription className="text-sm">{project.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Last activity: {project.lastActivity}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State for no projects */}
      {projects.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <FolderKanban className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
              <p className="text-sm text-muted-foreground">
                Projects assigned to you will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProjectsView;
