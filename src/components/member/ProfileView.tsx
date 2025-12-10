import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mail, Building2, Shield, CalendarDays, Settings } from "lucide-react";

interface ProfileViewProps {
  user: any;
  departmentName: string;
  streak: number;
  totalSubmissions: number;
}

const ProfileView = ({ user, departmentName, streak, totalSubmissions }: ProfileViewProps) => {
  const navigate = useNavigate();
  
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Profile</h2>
          <p className="text-muted-foreground">Your account information</p>
        </div>
        <Button onClick={() => navigate('/member/settings')} variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Edit Settings
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {user?.full_name?.charAt(0) || "?"}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{user?.full_name || "Unknown"}</h3>
                <p className="text-muted-foreground capitalize">{user?.role || "member"}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user?.email || "N/A"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm font-medium">{departmentName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm font-medium capitalize">{user?.role || "member"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">{formatDate(user?.created_at)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
              <span className="text-3xl mb-1 block">🔥</span>
              <div className="text-2xl font-bold text-orange-600">{streak}</div>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20">
              <div className="text-2xl font-bold text-blue-600">{totalSubmissions}</div>
              <p className="text-xs text-muted-foreground">Total Submissions</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileView;
