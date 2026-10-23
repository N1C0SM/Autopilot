import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/contexts/AuthContext";
import { supabase } from "@/shared/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Spinner } from "@/shared/components/ui/spinner";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
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
} from "@/shared/components/ui/alert-dialog";

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
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  const displayName = name.trim();
  const canResign = assignedClientCount === 0;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 pb-2 pt-2">
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Cabecera al estilo Apple ID: la foto y el nombre que ven tus clientes. */}
        <div className="flex flex-col items-center px-4 text-center">
          <button
            type="button"
            aria-label="Cambiar foto de perfil"
            onClick={() => { void hapticTap(); photoInputRef.current?.click(); }}
            className="rounded-full transition-opacity active:opacity-70"
          >
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={photoPreview || photoUrl || undefined} alt="" className="object-cover" />
              <AvatarFallback className="bg-secondary text-muted-foreground">
                {displayName ? (
                  <span aria-hidden="true" className="font-rounded type-large-title">{displayName.charAt(0).toUpperCase()}</span>
                ) : (
                  <UserRound className="h-9 w-9" strokeWidth={1.75} />
                )}
              </AvatarFallback>
            </Avatar>
          </button>
          <p className="mt-3 max-w-full truncate type-title2">{displayName || "Tu perfil"}</p>
          {user?.email ? <p className="max-w-full truncate type-body text-muted-foreground">{user.email}</p> : null}
          <label
            htmlFor="trainer-photo"
            onClick={() => { void hapticTap(); }}
            className="mt-1 inline-flex min-h-11 cursor-pointer items-center px-3 type-body text-primary transition-opacity active:opacity-60"
          >
            Cambiar foto
          </label>
          <input
            ref={photoInputRef}
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
          {photoFile ? (
            <p className="type-footnote text-muted-foreground">Guarda los cambios para usar la foto nueva.</p>
          ) : null}
        </div>

        <ListGroup footer="Tus clientes asignados seguirán viendo tu nombre y foto en su dashboard. Foto de hasta 5 MB.">
          <div className="group/row flex min-h-[44px] items-center px-4">
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 group-[:not(:last-child)]/row:sep-b">
              <label htmlFor="trainer-name" className="shrink-0 type-body">Nombre</label>
              <Input
                id="trainer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                placeholder="Tu nombre"
                autoCapitalize="words"
                autoComplete="name"
                enterKeyHint="done"
                className="h-11 min-w-0 flex-1 bg-transparent px-0 text-right"
              />
            </div>
          </div>
          <ListRow
            title={<label htmlFor="trainer-public-profile">Perfil público</label>}
            subtitle="Apareces en la página de entrenadores."
            trailing={
              <Switch
                id="trainer-public-profile"
                checked={publicProfileVisible}
                onCheckedChange={(visible) => { void hapticSelection(); setPublicProfileVisible(visible); }}
                aria-label="Mostrar mi perfil en la página pública de entrenadores"
              />
            }
          />
          <button
            type="submit"
            disabled={saving}
            onClick={() => { void hapticTap(); }}
            className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left type-body text-primary transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-40"
          >
            {saving ? <Spinner size="sm" className="text-current" label="Guardando" /> : null}
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </ListGroup>
      </form>

      <ListGroup header="Sesión" footer="Cierra tu sesión en este dispositivo.">
        <ListRow title="Cerrar sesión" destructive onClick={() => { void handleSignOut(); }} />
      </ListGroup>

      <ListGroup
        header="Cuenta de entrenador"
        footer={canResign
          ? undefined
          : `El administrador debe reasignar ${assignedClientCount === 1 ? "tu cliente" : `tus ${assignedClientCount} clientes`} antes de que puedas renunciar.`}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={resigning || !canResign}
              onClick={() => { void hapticNotify("warning"); }}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left type-body text-destructive transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-40"
            >
              <span className="min-w-0 flex-1 truncate">Renunciar al rol</span>
              {resigning ? <Spinner size="sm" /> : null}
            </button>
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
      </ListGroup>
    </div>
  );
};

export default TrainerSelfProfile;
