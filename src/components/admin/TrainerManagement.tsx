import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, UserPlus, X, User2, Users as UsersIcon, Search, Award } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hapticNotify, hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TrainerCertificates from "./TrainerCertificates";
import Chat from "@/components/Chat";
import type { Profile } from "@/pages/Admin";
import { FieldRow } from "./AdminOpsParts";

interface TrainerProfile {
  id?: string;
  user_id: string;
  display_name: string;
  headline: string;
  bio: string;
  photo_url: string;
  specialty: string;
  sort_order: number;
  visible: boolean;
}

interface Assignment {
  id: string;
  trainer_id: string;
  user_id: string;
}

interface Props {
  allUsers: Profile[];
  trainerIds: Set<string>;
  adminIds: Set<string>;
  onRolesChange: () => void;
  /**
   * Optional. When the host owns the nav bar it receives the open trainer's name and a back handler
   * (and `null` when the list is shown again); the in-content back button and name are then desktop-only.
   */
  onDetailChange?: (detail: { title: string; onBack: () => void } | null) => void;
}

const blankProfile = (user_id: string): TrainerProfile => ({
  user_id,
  display_name: "",
  headline: "",
  bio: "",
  photo_url: "",
  specialty: "",
  sort_order: 0,
  visible: true,
});

const TrainerManagement = ({ allUsers, trainerIds, adminIds, onRolesChange, onDetailChange }: Props) => {
  const [selectedTrainer, setSelectedTrainer] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trainers = allUsers.filter((u) => trainerIds.has(u.user_id));

  const hostBar = Boolean(onDetailChange);
  const onDetailChangeRef = useRef(onDetailChange);
  const closeDetail = useCallback(() => setSelectedTrainer(null), []);
  const hostTitle = selectedTrainer ? selectedTrainer.name?.trim() || selectedTrainer.email.split("@")[0] : null;
  useEffect(() => { onDetailChangeRef.current = onDetailChange; });
  useEffect(() => {
    onDetailChangeRef.current?.(hostTitle ? { title: hostTitle, onBack: closeDetail } : null);
  }, [hostTitle, closeDetail]);
  useEffect(() => () => onDetailChangeRef.current?.(null), []);

  useEffect(() => {
    supabase.from("trainer_assignments").select("*").then(({ data }) => {
      if (data) setAllAssignments(data as Assignment[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedTrainer) return;
    setLoading(true);
    (async () => {
      const [{ data: tp }, { data: a }] = await Promise.all([
        supabase.from("trainer_profiles").select("*").eq("user_id", selectedTrainer.user_id).maybeSingle(),
        supabase.from("trainer_assignments").select("*").eq("trainer_id", selectedTrainer.user_id),
      ]);
      setProfile((tp as TrainerProfile) || blankProfile(selectedTrainer.user_id));
      setAssignments((a as Assignment[]) || []);
      setLoading(false);
    })();
  }, [selectedTrainer]);

  const promoteToTrainer = async (userId: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "trainer" });
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Usuario promovido a entrenador");
    setPromoteOpen(false);
    onRolesChange();
  };

  const removeTrainerRole = async (userId: string) => {
    await supabase.from("trainer_assignments").delete().eq("trainer_id", userId);
    await supabase.from("trainer_profiles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "trainer");
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Rol de entrenador eliminado");
    setSelectedTrainer(null);
    onRolesChange();
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { data, error } = await supabase.from("trainer_profiles").upsert(profile, { onConflict: "user_id" }).select().single();
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
    if (data) setProfile(data);
    toast.success("Perfil guardado");
  };

  const uploadPhoto = async (file: File) => {
    if (!profile) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `trainers/${profile.user_id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo foto: " + error.message); return; }
    const url = supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
    setProfile({ ...profile, photo_url: url });
    toast.success("Foto subida");
  };

  const assignUser = async (userId: string) => {
    if (!selectedTrainer) return;
    // If user already assigned to another trainer, replace
    const existing = allAssignments.find((a) => a.user_id === userId);
    if (existing) await supabase.from("trainer_assignments").delete().eq("user_id", userId);
    const { data, error } = await supabase
      .from("trainer_assignments")
      .insert({ trainer_id: selectedTrainer.user_id, user_id: userId })
      .select()
      .single();
    if (error) { toast.error("Error: " + error.message); return; }
    setAssignments((a) => [...a, data as Assignment]);
    setAllAssignments((a) => [...a.filter((x) => x.user_id !== userId), data as Assignment]);
    toast.success("Usuario asignado");
  };

  const unassignUser = async (assignmentId: string, userId: string) => {
    const { error } = await supabase.from("trainer_assignments").delete().eq("id", assignmentId);
    if (error) { toast.error("Error: " + error.message); return; }
    setAssignments((a) => a.filter((x) => x.id !== assignmentId));
    setAllAssignments((a) => a.filter((x) => x.id !== assignmentId));
    toast.success("Usuario desasignado");
  };

  const assignedUserObjs = assignments
    .map((a) => allUsers.find((u) => u.user_id === a.user_id))
    .filter(Boolean) as Profile[];

  const assignableUsers = allUsers.filter(
    (u) =>
      !trainerIds.has(u.user_id) &&
      !adminIds.has(u.user_id) &&
      !assignments.some((a) => a.user_id === u.user_id) &&
      u.email.toLowerCase().includes(search.toLowerCase())
  );


  const promotableUsers = allUsers
    .filter((u) => !trainerIds.has(u.user_id) && !adminIds.has(u.user_id))
    .filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 30);

  const initial = (label: string) => label.charAt(0).toUpperCase();
  const avatar = (label: string) => (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
      <span className="type-footnote font-semibold text-muted-foreground">{initial(label)}</span>
    </div>
  );
  const plural = (n: number) => `${n} usuario${n !== 1 ? "s" : ""} asignado${n !== 1 ? "s" : ""}`;

  const searchField = (
    <Input type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Buscar por email…" aria-label="Buscar por email" value={search} onChange={(e) => setSearch(e.target.value)} />
  );

  // Trainer detail view
  if (selectedTrainer) {
    const ownProfile = profile && profile.user_id === selectedTrainer.user_id ? profile : null;
    const trainerName = ownProfile?.display_name.trim() || selectedTrainer.name?.trim() || selectedTrainer.email.split("@")[0];

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Button variant="plain" className={cn("-ml-2 gap-0.5 pl-1 pr-3", hostBar && "hidden md:inline-flex")} aria-label="Volver a entrenadores" onClick={() => { void hapticTap(); setSelectedTrainer(null); }}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> Entrenadores
          </Button>
          <h2 className={cn("mt-1 truncate type-title2", hostBar && "hidden md:block")}>{trainerName}</h2>
          <p className="truncate type-subhead text-muted-foreground">{selectedTrainer.email}</p>
          <p className="type-footnote text-muted-foreground">{plural(assignments.length)}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <Tabs defaultValue="profile" className="space-y-6" onValueChange={() => void hapticSelection()}>
            <TabsList className="w-full">
              <TabsTrigger value="profile" className="flex-1">Perfil público</TabsTrigger>
              <TabsTrigger value="users" className="flex-1">Usuarios</TabsTrigger>
              <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              {profile && (
                <>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile.photo_url || undefined} alt="" />
                      <AvatarFallback className="text-muted-foreground">
                        <User2 className="h-8 w-8" strokeWidth={1.75} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <label className="inline-flex min-h-[44px] cursor-pointer items-center type-body text-primary transition-opacity active:opacity-60">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
                        Subir foto
                      </label>
                      {profile.photo_url && (
                        <button type="button" onClick={() => { void hapticTap(); setProfile({ ...profile, photo_url: "" }); }} className="min-h-[44px] type-subhead text-muted-foreground transition-opacity active:opacity-60">
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>

                  <ListGroup>
                    <ListRow
                      title="Visible en la landing"
                      subtitle="Aparecerá en la sección «Entrenadores»"
                      trailing={<Switch aria-label="Visible en la landing" checked={profile.visible} onCheckedChange={(v) => { void hapticSelection(); setProfile({ ...profile, visible: v }); }} />}
                    />
                    <FieldRow label="Nombre público" htmlFor="trainer-display-name">
                      <Input id="trainer-display-name" autoCapitalize="words" enterKeyHint="next" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} placeholder="Carlos Méndez" />
                    </FieldRow>
                    <FieldRow label="Especialidad" htmlFor="trainer-specialty">
                      <Input id="trainer-specialty" enterKeyHint="next" value={profile.specialty} onChange={(e) => setProfile({ ...profile, specialty: e.target.value })} placeholder="Hipertrofia · Calistenia" />
                    </FieldRow>
                    <FieldRow label="Titular corto" htmlFor="trainer-headline">
                      <Input id="trainer-headline" enterKeyHint="next" value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} placeholder="Entrenamiento de fuerza adaptado a tu nivel" />
                    </FieldRow>
                    <FieldRow label="Bio" htmlFor="trainer-bio">
                      <Textarea id="trainer-bio" rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Cuenta brevemente quién eres y a quién ayudas…" />
                    </FieldRow>
                    <FieldRow label="Orden" htmlFor="trainer-sort-order">
                      <Input id="trainer-sort-order" className="max-w-[120px]" type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" value={profile.sort_order} onChange={(e) => setProfile({ ...profile, sort_order: parseInt(e.target.value) || 0 })} />
                    </FieldRow>
                  </ListGroup>

                  <Button variant="hero" size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); void saveProfile(); }} disabled={saving}>
                    {saving && <Spinner size="sm" className="text-primary-foreground" />}
                    {saving ? "Guardando…" : "Guardar perfil"}
                  </Button>

                  <div className="sep-t">
                    {profile.id ? <TrainerCertificates key={profile.id} profileId={profile.id} /> : (
                      <div className="flex items-start gap-3.5 pt-6">
                        <Award className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
                        <div>
                          <p className="type-headline">Certificados</p>
                          <p className="type-subhead text-muted-foreground">Guarda primero el perfil para añadir certificados.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <ListGroup footer="Se eliminan sus asignaciones y su perfil público.">
                    <ListRow title="Quitar rol de entrenador" destructive onClick={() => { void hapticNotify("warning"); setRemoveOpen(true); }} />
                  </ListGroup>
                </>
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              {assignedUserObjs.length === 0 ? (
                <EmptyState icon={UsersIcon} title="Aún no hay usuarios asignados" description="Elige uno de la lista de abajo." className="py-8" />
              ) : (
                <ListGroup header={`Usuarios asignados (${assignedUserObjs.length})`}>
                  {assignedUserObjs.map((u) => {
                    const a = assignments.find((x) => x.user_id === u.user_id)!;
                    return (
                      <ListRow
                        key={u.user_id}
                        leading={avatar(u.email)}
                        title={u.email}
                        trailing={
                          <Button variant="ghost" size="icon" className="-my-1.5" aria-label="Quitar usuario" onClick={() => { void hapticTap(); void unassignUser(a.id, u.user_id); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        }
                      />
                    );
                  })}
                </ListGroup>
              )}

              <div className="space-y-3">
                <h2 className="type-group-header px-4">Asignar usuario</h2>
                {searchField}
                {assignableUsers.length === 0 ? (
                  <EmptyState icon={Search} title="No hay usuarios disponibles" className="py-8" />
                ) : (
                  <div className="max-h-80 overflow-y-auto rounded-2xl">
                    <ListGroup>
                      {assignableUsers.slice(0, 30).map((u) => {
                        const previousTrainer = allAssignments.find((a) => a.user_id === u.user_id);
                        return (
                          <ListRow
                            key={u.user_id}
                            leading={avatar(u.email)}
                            title={u.email}
                            value={
                              <span className="flex items-center gap-2">
                                {previousTrainer && <span className="type-caption1">Reasignar</span>}
                                <UserPlus className="h-5 w-5 text-primary" />
                              </span>
                            }
                            onClick={() => void assignUser(u.user_id)}
                          />
                        );
                      })}
                    </ListGroup>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="chat">
              <Chat conversationUserId={selectedTrainer.user_id} isAdmin />
              <p className="mt-2 text-center type-footnote text-muted-foreground">Conversación privada admin ↔ entrenador.</p>
            </TabsContent>
          </Tabs>
        )}

        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Quitar el rol de entrenador?</AlertDialogTitle>
              <AlertDialogDescription>Sus asignaciones y su perfil público se eliminarán.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction destructive onClick={() => void removeTrainerRole(selectedTrainer.user_id)}>Quitar rol</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Trainer list
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="type-subhead text-muted-foreground">{trainers.length} entrenador{trainers.length !== 1 ? "es" : ""}</p>

      {trainers.length > 0 ? (
        <>
          <ListGroup>
            {trainers.map((t) => {
              const count = allAssignments.filter((a) => a.trainer_id === t.user_id).length;
              return (
                <ListRow
                  key={t.user_id}
                  leading={avatar(t.name?.trim() || t.email)}
                  title={t.name?.trim() || t.email}
                  subtitle={plural(count)}
                  chevron
                  onClick={() => setSelectedTrainer(t)}
                />
              );
            })}
          </ListGroup>

          <ListGroup>
            <ListRow
              icon={<UserPlus />}
              title={<span className="text-primary">Promover usuario</span>}
              onClick={() => setPromoteOpen((v) => !v)}
            />
          </ListGroup>
        </>
      ) : (
        <EmptyState
          icon={UsersIcon}
          title="No hay entrenadores aún"
          description="Promueve a un usuario para que aparezca aquí."
          action={
            <Button variant="plain" onClick={() => { void hapticTap(); setPromoteOpen(true); }}>
              Promover primer entrenador
            </Button>
          }
        />
      )}

      {promoteOpen && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="type-group-header px-4">Promover a entrenador</h2>
            <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => { void hapticTap(); setPromoteOpen(false); }}><X className="h-4 w-4" /></Button>
          </div>
          {searchField}
          {promotableUsers.length === 0 ? (
            <EmptyState icon={Search} title="No hay usuarios disponibles" className="py-8" />
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-2xl">
              <ListGroup>
                {promotableUsers.map((u) => (
                  <ListRow
                    key={u.user_id}
                    leading={avatar(u.email)}
                    title={u.email}
                    value={<UserPlus className="h-5 w-5 text-primary" />}
                    onClick={() => void promoteToTrainer(u.user_id)}
                  />
                ))}
              </ListGroup>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrainerManagement;
