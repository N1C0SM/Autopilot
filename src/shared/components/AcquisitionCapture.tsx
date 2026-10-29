import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/shared/contexts/AuthContext";
import { isNativeApp } from "@/shared/lib/platform";
import { captureFirstTouch, claimAcquisition, readFirstTouch, recordAcquisitionEvent } from "@/shared/lib/acquisition";

/** Guarda de qué red llega cada visitante de la web y lo une a su cuenta al registrarse. */
const AcquisitionCapture = () => {
  const { search, pathname } = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || isNativeApp()) return;
    // Quien ya tiene sesión no es un visitante nuevo: solo se le une el origen guardado.
    if (user) return;
    const { touch, isNew } = captureFirstTouch({ search, pathname });
    if (isNew) void recordAcquisitionEvent("visit", touch);
  }, [search, pathname, user, loading]);

  useEffect(() => {
    if (!user || isNativeApp()) return;
    void claimAcquisition(user.id, readFirstTouch());
  }, [user]);

  return null;
};

export default AcquisitionCapture;
