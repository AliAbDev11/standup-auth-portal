import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        switch (profile.role) {
          case "superadmin":
            navigate("/admin/dashboard");
            break;
          case "manager":
            navigate("/manager/dashboard");
            break;
          case "member":
            navigate("/member/dashboard");
            break;
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" 
         style={{ background: "var(--gradient-auth)" }}>
      <div className="text-center animate-in fade-in duration-500">
        <div className="bg-card rounded-2xl p-12 shadow-2xl border border-border/50 max-w-md mx-4"
             style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
              <LogIn className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Daily Standup System
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Streamline your team's daily updates and collaboration
          </p>
          <Button 
            onClick={() => navigate("/auth")}
            size="lg"
            className="w-full h-12 text-base font-semibold"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
