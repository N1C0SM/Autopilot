import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, UserPlus, Save, X, MessageCircle, User2, Users as UsersIcon, Upload, Award } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticNotify, hapticSelection, hapticTap } from "@/lib/native";
import { toast } from "sonner";
import TrainerCertificates from "./TrainerCertificates";
import Chat from "@/components/Chat";
import type { Profile } from "@/pages/Admin";

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

const TrainerManagement = ({ allUsers, trainerIds, adminIds, onRolesChange }: Props) => {
  const [selectedTrainer, setSelectedTrainer] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trainers = allUsers.filter((u) => trainerIds.has(u.user_id));

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
    if (!confirm("¿Quitar el rol de entrenador? Sus asignaciones se eliminarán.")) return;
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

  const initial = (email: string) => email.charAt(0).toUpperCase();
  const avatar = (email: string, size = "h-10 w-10") => (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-secondary`}>
      <span className="type-subhead font-semibold">{initial(email)}</span>
    </div>
  );
  const plural = (n: number) => `${n} usuario${n !== 1 ? "s" : ""} asignado${n !== 1 ? "s" : ""}`;

  // Trainer detail view
  if (selectedTrainer) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Volver" onClick={() => { void hapticTap(); setSelectedTrainer(null); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="type-title2 truncate">{selectedTrainer.email}</h1>
            <p className="type-footnote text-muted-foreground">Entrenador · {assignments.length} usuario{assignments.length !== 1 ? "s" : ""} asignado{assignments.length !== 1 ? "s" : ""}</p>
          </div>
          <Button variant="plain" className="text-destructive" onClick={() => { void hapticNotify("warning"); void removeTrainerRole(selectedTrainer.user_id); }}>
            Quitar rol
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <Tabs defaultValue="profile" className="space-y-6" onValueChange={() => void hapticSelection()}>
            <TabsList className="w-full">
              <TabsTrigger value="profile" className="flex-1 gap-1.5"><User2 className="h-4 w-4" /> Perfil público</TabsTrigger>
              <TabsTrigger value="users" className="flex-1 gap-1.5"><UsersIcon className="h-4 w-4" /> Usuarios</TabsTrigger>
              <TabsTrigger value="chat" className="flex-1 gap-1.5"><MessageCircle className="h-4 w-4" /> Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              {profile && (
                <>
                  <div className="flex items-center gap-4">
                    {profile.photo_url ? (
                      <img loading="lazy" decoding="async" src={profile.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User2 className="h-8 w-8" strokeWidth={1.75} />
                      </div>
                    )}
                    <div className="flex flex-col items-start">
                      <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 type-body text-primary transition-opacity active:opacity-60">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
                        <Upload className="h-4 w-4" /> Subir foto
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
                      trailing={<Switch checked={profile.visible} onCheckedChange={(v) => { void hapticSelection(); setProfile({ ...profile, visible: v }); }} />}
                    />
                  </ListGroup>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="mb-1.5 block text-muted-foreground">Nombre público</Label>
                        <Input autoCapitalize="words" enterKeyHint="next" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} placeholder="Carlos Méndez" />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-muted-foreground">Especialidad</Label>
                        <Input enterKeyHint="next" value={profile.specialty} onChange={(e) => setProfile({ ...profile, specialty: e.target.value })} placeholder="Hipertrofia · Calistenia" />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-muted-foreground">Titular corto</Label>
                      <Input enterKeyHint="next" value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} placeholder="Entrenamiento de fuerza adaptado a tu nivel" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-muted-foreground">Bio</Label>
                      <Textarea rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Cuenta brevemente quién eres y a quién ayudas…" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-muted-foreground">Orden</Label>
                      <Input className="max-w-[120px]" type="number" inputMode="numeric" enterKeyHint="done" value={profile.sort_order} onChange={(e) => setProfile({ ...profile, sort_order: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <Button variant="hero" size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); void saveProfile(); }} disabled={saving}>
                    {saving ? <Spinner size="sm" className="text-primary-foreground" /> : <Save className="h-4 w-4" />} {saving ? "Guardando..." : "Guardar perfil"}
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
                </>
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <ListGroup header={`Usuarios asignados (${assignedUserObjs.length})`}>
                {assignedUserObjs.length === 0 ? (
                  <p className="px-4 py-3 type-subhead text-muted-foreground">Aún no hay usuarios asignados.</p>
                ) : (
                  assignedUserObjs.map((u) => {
                    const a = assignments.find((x) => x.user_id === u.user_id)!;
                    return (
                      <div key={u.user_id} className="sep-t flex min-h-[56px] items-center gap-3 px-4 first:border-t-0">
                        {avatar(u.email, "h-8 w-8")}
                        <span className="min-w-0 flex-1 truncate type-body">{u.email}</span>
                        <Button variant="ghost" size="icon" aria-label="Quitar usuario" onClick={() => { void hapticTap(); void unassignUser(a.id, u.user_id); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </ListGroup>

              <div className="space-y-3">
                <h2 className="type-group-header px-4">Asignar usuario</h2>
                <Input type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="max-h-80 overflow-y-auto rounded-2xl"><ListGroup>
                  {assignableUsers.slice(0, 30).map((u) => {
                    const previousTrainer = allAssignments.find((a) => a.user_id === u.user_id);
                    return (
                      <button
                        key={u.user_id}
                        onClick={() => { void hapticTap(); void assignUser(u.user_id); }}
                        className="sep-t flex min-h-[56px] w-full items-center gap-3 px-4 text-left transition-colors first:border-t-0 active:bg-accent"
                      >
                        {avatar(u.email, "h-8 w-8")}
                        <span className="min-w-0 flex-1 truncate type-body">{u.email}</span>
                        {previousTrainer && <span className="type-caption1 text-muted-foreground">Reasignar</span>}
                        <UserPlus className="h-5 w-5 text-primary" />
                      </button>
                    );
                  })}
                  {assignableUsers.length === 0 && <p className="px-4 py-6 text-center type-subhead text-muted-foreground">No hay usuarios disponibles.</p>}
                </ListGroup></div>
              </div>
            </TabsContent>

            <TabsContent value="chat">
              <Chat conversationUserId={selectedTrainer.user_id} isAdmin />
              <p className="mt-2 text-center type-footnote text-muted-foreground">Conversación privada admin ↔ entrenador.</p>
            </TabsContent>
          </Tabs>
        )}
      </div>
    );
  }

  // Trainer list
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="type-large-title md:type-title1">Entrenadores</h1>
          <p className="mt-1 type-subhead text-muted-foreground">{trainers.length} entrenador{trainers.length !== 1 ? "es" : ""}</p>
        </div>
        <Button variant="hero" onClick={() => { void hapticTap(); setPromoteOpen((v) => !v); }}>
          <UserPlus className="h-4 w-4" /> Promover usuario
        </Button>
      </div>

      {promoteOpen && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="type-group-header px-4">Promover a entrenador</h2>
            <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => { void hapticTap(); setPromoteOpen(false); }}><X className="h-4 w-4" /></Button>
          </div>
          <Input type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto rounded-2xl"><ListGroup>
            {allUsers
              .filter((u) => !trainerIds.has(u.user_id) && !adminIds.has(u.user_id))
              .filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 30)
              .map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => { void hapticTap(); void promoteToTrainer(u.user_id); }}
                  className="sep-t flex min-h-[56px] w-full items-center gap-3 px-4 text-left transition-colors first:border-t-0 active:bg-accent"
                >
                  {avatar(u.email, "h-8 w-8")}
                  <span className="min-w-0 flex-1 truncate type-body">{u.email}</span>
                  <UserPlus className="h-5 w-5 text-primary" />
                </button>
              ))}
          </ListGroup></div>
        </div>
      )}

      {trainers.length > 0 ? (
        <ListGroup>
          {trainers.map((t) => {
            const count = allAssignments.filter((a) => a.trainer_id === t.user_id).length;
            return (
              <ListRow
                key={t.user_id}
                leading={avatar(t.email)}
                title={t.email}
                subtitle={plural(count)}
                chevron
                onClick={() => setSelectedTrainer(t)}
              />
            );
          })}
        </ListGroup>
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
    </div>
  );
};

export default TrainerManagement;
