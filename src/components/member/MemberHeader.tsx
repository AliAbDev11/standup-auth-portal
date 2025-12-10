import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, FlaskConical, Settings, Menu } from "lucide-react";

interface MemberHeaderProps {
  user: any;
  departmentName: string;
  testMode: boolean;
  onTestModeToggle: () => void;
  onLogout: () => void;
  onMobileMenuToggle?: () => void;
}

const MemberHeader = ({ 
  user, 
  departmentName, 
  testMode, 
  onTestModeToggle, 
  onLogout,
  onMobileMenuToggle 
}: MemberHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Welcome, {user?.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">{departmentName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Test Mode Toggle */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border rounded-lg bg-background">
          <FlaskConical className={`w-4 h-4 ${testMode ? 'text-yellow-600' : 'text-muted-foreground'}`} />
          <Label htmlFor="test-mode-header" className="text-xs font-medium cursor-pointer hidden md:inline">
            Test Mode
          </Label>
          <Switch 
            id="test-mode-header"
            checked={testMode}
            onCheckedChange={onTestModeToggle}
            className="scale-90"
          />
        </div>

        <Button 
          onClick={() => navigate('/member/settings')} 
          variant="ghost" 
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-5 h-5" />
        </Button>

        <Button 
          onClick={onLogout} 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
};

export default MemberHeader;
