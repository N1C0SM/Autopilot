import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
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
    return <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>;
  }

  return (
    <div className="w-full min-w-0 max-w-xl mx-auto space-y-8 pt-2">
      <form onSubmit={handleSave} className="space-y-8">
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarImage src={photoPreview || photoUrl || undefined} alt={name || "Foto de perfil"} />
            <AvatarFallback><UserRound className="h-8 w-8" strokeWidth={1.75} /></AvatarFallback>
          </Avatar>
          <h1 className="mt-4 type-title2 max-w-full truncate">{name.trim() || "Mi perfil"}</h1>
          <p className="mt-1 type-subhead text-muted-foreground">Actualiza el nombre y la foto que ven tus clientes.</p>
          <Label
            htmlFor="trainer-photo"
            onClick={() => { void hapticTap(); }}
            className="mt-1 inline-flex min-h-11 cursor-pointer items-center px-3 type-body font-normal text-primary transition-opacity active:opacity-60"
          >
            Cambiar foto
          </Label>
          <input
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
          <p className="type-footnote text-muted-foreground">Imagen de hasta 5 MB.</p>
        </div>

        <div>
          <Label htmlFor="trainer-name" className="type-group-header block pl-4 pb-1.5 font-normal">Nombre</Label>
          <Input
            id="trainer-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            autoCapitalize="words"
            autoComplete="name"
            enterKeyHint="done"
          />
        </div>

        <ListGroup footer="Tus clientes asignados seguirán viendo tu nombre y foto en su dashboard.">
          <ListRow
            title={<Label htmlFor="trainer-public-profile" className="type-body font-normal">Mostrar mi perfil públicamente</Label>}
            trailing={
              <Switch
                id="trainer-public-profile"
                checked={publicProfileVisible}
                onCheckedChange={setPublicProfileVisible}
                aria-label="Mostrar mi perfil en la página pública de entrenadores"
              />
            }
          />
        </ListGroup>

        <Button type="submit" size="lg" disabled={saving} variant="hero" className="w-full">
          {saving ? <Spinner size="sm" className="text-primary-foreground" /> : null}
          Guardar cambios
        </Button>
      </form>

      <section className="space-y-1">
        <h2 className="type-group-header px-4 pb-1.5">Cuenta de entrenador</h2>
        {assignedClientCount > 0 && (
          <p className="px-4 pb-2 type-subhead text-muted-foreground">
            El administrador debe reasignar {assignedClientCount === 1 ? "tu cliente" : `tus ${assignedClientCount} clientes`} antes de que puedas renunciar.
          </p>
        )}
        <div className="flex flex-col items-stretch sm:flex-row sm:flex-wrap">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="plain" disabled={resigning || assignedClientCount > 0} className="w-full sm:w-auto">
                {resigning ? <Spinner size="sm" /> : <UserX className="h-5 w-5" />}
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
                <AlertDialogAction destructive onClick={handleResign}>Sí, renunciar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="plain" onClick={handleSignOut} className="w-full text-destructive sm:w-auto">
            <LogOut className="h-5 w-5" />Cerrar sesión
          </Button>
        </div>
      </section>
    </div>
  );
};

export default TrainerSelfProfile;
