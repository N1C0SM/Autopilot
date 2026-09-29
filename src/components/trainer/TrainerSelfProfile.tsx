import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Loader2, LogOut, Save, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TrainerSelfProfile = ({ assignedClientCount }: { assignedClientCount: number }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [publicProfileVisible, setPublicProfileVisible] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resigning, setResigning] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadProfile = async () => {
      const [profileResult, trainerResult] = await Promise.all([
        supabase.from("profiles").select("name, avatar_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("trainer_profiles").select("display_name, photo_url, visible").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (profileResult.error || trainerResult.error) {
        toast.error("No se pudo cargar tu perfil.");
      } else {
        setName(trainerResult.data?.display_name || profileResult.data?.name || "");
        setPhotoUrl(trainerResult.data?.photo_url || profileResult.data?.avatar_url || "");
        setPublicProfileVisible(trainerResult.data?.visible ?? false);
      }
      setLoading(false);
    };
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const displayName = name.trim();
    if (!displayName) {
      toast.error("Escribe tu nombre para continuar.");
      return;
    }
    setSaving(true);
    let nextPhotoUrl = photoUrl;
    if (photoFile) {
      const extension = photoFile.type === "image/png" ? "png" : photoFile.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/trainer-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, photoFile, {
        cacheControl: "3600",
        contentType: photoFile.type,
        upsert: false,
      });
      if (uploadError) {
        setSaving(false);
        toast.error("No se pudo subir la foto.");
        return;
      }
      nextPhotoUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.rpc("trainer_update_own_profile", {
      _display_name: displayName,
      _photo_url: nextPhotoUrl,
      _visible: publicProfileVisible,
    });
    setSaving(false);
    if (error) {
      toast.error("No se pudieron guardar los cambios.");
      return;
    }
    setName(displayName);
    setPhotoUrl(nextPhotoUrl);
    setPhotoFile(null);
    toast.success("Perfil actualizado.");
  };

  const handleResign = async () => {
    setResigning(true);
    const { error } = await supabase.rpc("trainer_resign");
    setResigning(false);
    if (error) {
      toast.error(error.message.includes("assigned_clients_exist")
        ? "Pide al administrador que reasigne a tus clientes antes de renunciar."
        : "No se pudo quitar tu rol de entrenador.");
      return;
    }
    toast.success("Has dejado el rol de entrenador.");
    navigate("/dashboard", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold font-display">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Actualiza el nombre y la foto que ven tus clientes.</p>
      </div>
      <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={photoPreview || photoUrl || undefined} alt={name || "Foto de perfil"} />
            <AvatarFallback><UserRound className="w-6 h-6" /></AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="trainer-photo" className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium">
              <Camera className="w-4 h-4" /> Cambiar foto
            </Label>
            <Input
              id="trainer-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                  toast.error("Elige una imagen de hasta 5 MB.");
                  event.target.value = "";
                  return;
                }
                setPhotoFile(file);
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">Imagen de hasta 5 MB.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trainer-name">Nombre</Label>
          <Input id="trainer-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor="trainer-public-profile">Mostrar mi perfil públicamente</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Tus clientes asignados seguirán viendo tu nombre y foto en su dashboard.
            </p>
          </div>
          <Switch
            id="trainer-public-profile"
            checked={publicProfileVisible}
            onCheckedChange={setPublicProfileVisible}
            aria-label="Mostrar mi perfil en la página pública de entrenadores"
          />
        </div>
        <Button type="submit" disabled={saving} variant="hero">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar cambios
        </Button>
      </form>

      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div>
          <h2 className="font-semibold">Cuenta de entrenador</h2>
          {assignedClientCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              El administrador debe reasignar {assignedClientCount === 1 ? "tu cliente" : `tus ${assignedClientCount} clientes`} antes de que puedas renunciar.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resigning || assignedClientCount > 0}>
                {resigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserX className="w-4 h-4 mr-2" />}
                Renunciar al rol
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Renunciar al rol de entrenador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se quitará tu acceso al panel de entrenador. Tu cuenta de Autopilot y tus datos personales no se eliminarán.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResign}>Sí, renunciar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" />Cerrar sesión</Button>
        </div>
      </section>
    </div>
  );
};

export default TrainerSelfProfile;
