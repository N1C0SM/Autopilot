import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Admins open their account inside /admin; everyone else goes to dashboard settings.
const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (data) { navigate("/admin?s=account", { replace: true }); return; }
      try { sessionStorage.setItem("autopilot_section", "settings"); } catch { /* noop */ }
      navigate("/dashboard", { replace: true });
    });
  }, [navigate, user]);
  return null;
};

export default Settings;
