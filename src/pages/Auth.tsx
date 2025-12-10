import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        redirectBasedOnRole(session.user.id);
      }
    };
    checkSession();
  }, []);

  const redirectBasedOnRole = async (userId: string) => {
    try {
      // First check if user is active
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_active")
        .eq("id", userId)
        .is("deleted_at", null)
        .single();

      if (profileError) {
        throw new Error("Profile not found");
      }

      if (!profile?.is_active) {
        throw new Error("Account is inactive. Please contact your administrator.");
      }

      // Fetch role from user_roles table (secure source of truth)
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("role", { ascending: true }) // superadmin < manager < member alphabetically works for priority
        .limit(1)
        .single();

      if (roleError || !userRole) {
        throw new Error("User role not found");
      }

      switch (userRole.role) {
        case "superadmin":
          navigate("/admin/dashboard");
          break;
        case "manager":
          navigate("/manager/dashboard");
          break;
        case "member":
          navigate("/member/dashboard");
          break;
        default:
          navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch user profile");
    }
  };

  const validateForm = () => {
    if (!email) {
      toast.error("Please enter your email");
      return false;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!password) {
      toast.error("Please enter your password");
      return false;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user && data.session) {
        toast.success("Welcome back!");
        await redirectBasedOnRole(data.user.id);
      } else {
        throw new Error("No user or session returned");
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" 
         style={{ background: "var(--gradient-auth)" }}>
      <div className="w-full max-w-md animate-in fade-in duration-500">
        <div 
          className="bg-card rounded-2xl p-8 shadow-2xl border border-border/50"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {/* Logo/Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <LogIn className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Daily Standup System
            </h1>
            <p className="text-muted-foreground">
              Sign in to submit your daily updates
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={isLoading}
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-foreground cursor-pointer"
                >
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
