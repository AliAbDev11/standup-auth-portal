import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ManagerSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  manager: {
    full_name: string;
    department_name: string;
  };
  onLogout: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  collapsed?: boolean;
}

const NavItem = ({ icon, label, to, onClick, active, collapsed }: NavItemProps) => {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center"
      )}
    >
      {icon}
      {!collapsed && <span className="font-medium">{label}</span>}
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return <button onClick={onClick} className="w-full">{content}</button>;
};

const ManagerSidebar = ({ isOpen, onToggle, manager, onLogout }: ManagerSidebarProps) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-50 flex flex-col",
          isOpen ? "w-64" : "w-0 lg:w-20",
          !isOpen && "overflow-hidden lg:overflow-visible"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">Manager Portal</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 flex-1">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Overview"
            to="/manager/dashboard"
            active={currentPath === "/manager/dashboard"}
            collapsed={!isOpen}
          />

          <NavItem
            icon={<Users size={20} />}
            label="Team Members"
            to="/manager/dashboard"
            active={false}
            collapsed={!isOpen}
          />

          <NavItem
            icon={<ClipboardList size={20} />}
            label="Standups"
            to="/manager/dashboard"
            active={false}
            collapsed={!isOpen}
          />

          <NavItem
            icon={<BarChart3 size={20} />}
            label="Reports"
            to="/manager/dashboard"
            active={false}
            collapsed={!isOpen}
          />

          <NavItem
            icon={<Calendar size={20} />}
            label="Leave Requests"
            to="/manager/dashboard"
            active={false}
            collapsed={!isOpen}
          />

          <div className="pt-4 mt-4 border-t border-border">
            <NavItem
              icon={<Settings size={20} />}
              label="Settings"
              to="/manager/settings"
              active={currentPath === "/manager/settings"}
              collapsed={!isOpen}
            />

            <NavItem
              icon={<LogOut size={20} />}
              label="Logout"
              onClick={onLogout}
              collapsed={!isOpen}
            />
          </div>
        </nav>

        {/* User Info */}
        {isOpen && (
          <div className="p-4 border-t border-border bg-accent/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="font-semibold text-primary">
                  {manager.full_name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{manager.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{manager.department_name}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default ManagerSidebar;
