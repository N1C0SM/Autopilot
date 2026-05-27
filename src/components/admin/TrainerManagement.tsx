import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, UserPlus, Loader2, Save, X, MessageCircle, User2, Users as UsersIcon, Upload } from "lucide-react";
import { toast } from "sonner";
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
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "trainer" as any });
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Usuario promovido a entrenador");
    setPromoteOpen(false);
    onRolesChange();
  };

  const removeTrainerRole = async (userId: string) => {
    if (!confirm("¿Quitar el rol de entrenador? Sus asignaciones se eliminarán.")) return;
    await supabase.from("trainer_assignments").delete().eq("trainer_id", userId);
    await supabase.from("trainer_profiles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "trainer" as any);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Rol de entrenador eliminado");
    setSelectedTrainer(null);
    onRolesChange();
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("trainer_profiles").upsert(profile, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
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

  // ─── Trainer detail view ───
  if (selectedTrainer) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTrainer(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display">{selectedTrainer.email}</h1>
            <p className="text-xs text-muted-foreground">Entrenador · {assignments.length} usuario{assignments.length !== 1 ? "s" : ""} asignado{assignments.length !== 1 ? "s" : ""}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => removeTrainerRole(selectedTrainer.user_id)}>
            Quitar rol
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
              <TabsTrigger value="profile" className="text-xs gap-1.5"><User2 className="w-3.5 h-3.5" /> Perfil público</TabsTrigger>
              <TabsTrigger value="users" className="text-xs gap-1.5"><UsersIcon className="w-3.5 h-3.5" /> Usuarios</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              {profile && (
                <div className="bg-card rounded-xl p-6 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Visible en la landing</Label>
                      <p className="text-xs text-muted-foreground">Aparecerá en la sección "Entrenadores"</p>
                    </div>
                    <Switch checked={profile.visible} onCheckedChange={(v) => setProfile({ ...profile, visible: v })} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre público</Label>
                      <Input className="mt-1.5" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} placeholder="Carlos Méndez" />
                    </div>
                    <div>
                      <Label>Especialidad</Label>
                      <Input className="mt-1.5" value={profile.specialty} onChange={(e) => setProfile({ ...profile, specialty: e.target.value })} placeholder="Hipertrofia · Calistenia" />
                    </div>
                  </div>
                  <div>
                    <Label>Titular corto</Label>
                    <Input className="mt-1.5" value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} placeholder="Entrenador certificado · 5 años" />
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <Textarea className="mt-1.5" rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Cuenta brevemente quién eres y a quién ayudas..." />
                  </div>
                  <div>
                    <Label>Foto de perfil</Label>
                    <div className="mt-1.5 flex items-center gap-4">
                      {profile.photo_url ? (
                        <img src={profile.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                          <User2 className="w-8 h-8" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
                          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary">
                            <Upload className="w-3.5 h-3.5" /> Subir foto
                          </span>
                        </label>
                        {profile.photo_url && (
                          <button type="button" onClick={() => setProfile({ ...profile, photo_url: "" })} className="text-[11px] text-muted-foreground hover:text-destructive text-left">
                            Quitar foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Orden</Label>
                    <Input className="mt-1.5 max-w-[120px]" type="number" value={profile.sort_order} onChange={(e) => setProfile({ ...profile, sort_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <Button variant="hero" onClick={saveProfile} disabled={saving}>
                    <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando..." : "Guardar perfil"}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="bg-card rounded-xl p-6 border border-border">
                <h3 className="font-display font-bold text-sm mb-3">Usuarios asignados ({assignedUserObjs.length})</h3>
                {assignedUserObjs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no hay usuarios asignados.</p>
                ) : (
                  <div className="space-y-2">
                    {assignedUserObjs.map((u) => {
                      const a = assignments.find((x) => x.user_id === u.user_id)!;
                      return (
                        <div key={u.user_id} className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <span className="text-xs font-bold">{u.email.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="flex-1 text-sm truncate">{u.email}</span>
                          <Button variant="ghost" size="icon" onClick={() => unassignUser(a.id, u.user_id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl p-6 border border-border">
                <h3 className="font-display font-bold text-sm mb-3">Asignar usuario</h3>
                <Input placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {assignableUsers.slice(0, 30).map((u) => {
                    const previousTrainer = allAssignments.find((a) => a.user_id === u.user_id);
                    return (
                      <button
                        key={u.user_id}
                        onClick={() => assignUser(u.user_id)}
                        className="w-full flex items-center gap-3 hover:bg-secondary/50 rounded-lg px-3 py-2 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-xs font-bold">{u.email.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="flex-1 text-sm truncate">{u.email}</span>
                        {previousTrainer && <span className="text-[10px] text-amber-400">Reasignar</span>}
                        <UserPlus className="w-4 h-4 text-primary" />
                      </button>
                    );
                  })}
                  {assignableUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No hay usuarios disponibles.</p>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chat">
              <Chat conversationUserId={selectedTrainer.user_id} isAdmin />
              <p className="text-[11px] text-muted-foreground mt-2 text-center">Conversación privada admin ↔ entrenador.</p>
            </TabsContent>
          </Tabs>
        )}
      </div>
    );
  }

  // ─── Trainer list ───
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Entrenadores</h1>
          <p className="text-sm text-muted-foreground mt-1">{trainers.length} entrenador{trainers.length !== 1 ? "es" : ""}</p>
        </div>
        <Button variant="hero" onClick={() => setPromoteOpen((v) => !v)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Promover usuario
        </Button>
      </div>

      {promoteOpen && (
        <div className="bg-card rounded-xl p-5 border border-border mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm">Promover a entrenador</h3>
            <Button variant="ghost" size="icon" onClick={() => setPromoteOpen(false)}><X className="w-4 h-4" /></Button>
          </div>
          <Input placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {allUsers
              .filter((u) => !trainerIds.has(u.user_id) && !adminIds.has(u.user_id))
              .filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 30)
              .map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => promoteToTrainer(u.user_id)}
                  className="w-full flex items-center gap-3 hover:bg-secondary/50 rounded-lg px-3 py-2 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-xs font-bold">{u.email.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="flex-1 text-sm truncate">{u.email}</span>
                  <UserPlus className="w-4 h-4 text-primary" />
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {trainers.map((t) => {
          const count = allAssignments.filter((a) => a.trainer_id === t.user_id).length;
          return (
            <div
              key={t.user_id}
              onClick={() => setSelectedTrainer(t)}
              className="bg-card rounded-xl p-4 border border-border flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{t.email.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{t.email}</div>
                <div className="text-xs text-muted-foreground">{count} usuario{count !== 1 ? "s" : ""} asignado{count !== 1 ? "s" : ""}</div>
              </div>
              <span className="text-muted-foreground group-hover:text-primary">→</span>
            </div>
          );
        })}
        {trainers.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground mb-3">No hay entrenadores aún.</p>
            <Button variant="outline" size="sm" onClick={() => setPromoteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Promover primer entrenador
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerManagement;