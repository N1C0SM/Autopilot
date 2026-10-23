import { errorMessage } from "@/shared/lib/runtimeValues";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Target, UserRound } from "lucide-react";
import { toast } from "sonner";
import { hapticNotify, hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { skipAutoFocusOnTouch } from "@/app/components/admin-library/touchAutoFocus";

interface GoalPhysique {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
  visible: boolean;
}

const uploadImage = async (file: File) => {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `goal-physiques/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
};

/** Foto con respaldo compuesto: sin URL o con la carga fallida se ve el hueco gris, nunca la imagen rota. */
const PhysiqueImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-secondary", className)}>
      {src && !failed ? (
        <img
          loading="lazy"
          decoding="async"
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <UserRound className="h-1/2 w-1/2 text-muted-foreground/60" strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
    </div>
  );
};

const GoalPhysiquesEditor = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GoalPhysique[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("goal_physiques")
      .select("*")
      .order("sort_order", { ascending: true });
    setItems((data as GoalPhysique[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEditor = (id: string) => {
    setEditingId(id);
    setSheetOpen(true);
  };

  const add = async () => {
    void hapticTap();
    const { data, error } = await supabase
      .from("goal_physiques")
      .insert({ name: "Nuevo físico", image_url: "", sort_order: items.length, visible: true })
      .select()
      .single();
    if (error) { toast.error("No se pudo crear"); return; }
    const created = data as GoalPhysique;
    setItems((p) => [...p, created]);
    openEditor(created.id);
  };

  const update = (id: string, patch: Partial<GoalPhysique>) => {
    setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const save = async (it: GoalPhysique) => {
    const { error } = await supabase
      .from("goal_physiques")
      .update({
        name: it.name,
        image_url: it.image_url,
        visible: it.visible,
      })
      .eq("id", it.id);
    if (error) {
      void hapticNotify("error");
      toast.error("Error al guardar");
      return false;
    }
    void hapticNotify("success");
    toast.success("Guardado");
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("goal_physiques").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    setItems((p) => p.filter((it) => it.id !== id));
  };

  const onPhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      update(id, { image_url: url });
      // auto-save URL
      await supabase.from("goal_physiques").update({ image_url: url }).eq("id", id);
      toast.success("Foto subida");
    } catch (err: unknown) {
      toast.error(errorMessage(err) ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const editing = items.find((it) => it.id === editingId) ?? null;

  return (
    <div className="space-y-6 md:max-w-2xl">
      <div className="space-y-4">
        <p className="type-subhead text-muted-foreground">
          Físicos de referencia que verán los usuarios en el AI Scan. Pueden elegir uno como objetivo en vez de subir su propia foto.
        </p>
        <Button type="button" size="lg" className="w-full md:w-auto" onClick={add}>
          Añadir físico
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Aún no hay físicos"
          description="Añade el primero con una foto y un nombre."
        />
      ) : (
        <ListGroup>
          {items.map((it) => (
            <ListRow
              key={it.id}
              leading={<PhysiqueImage key={it.image_url} src={it.image_url} alt="" className="h-14 w-14 rounded-[10px]" />}
              title={it.name.trim() || "Sin nombre"}
              value={it.visible ? "Visible" : "Oculto"}
              chevron
              onClick={() => openEditor(it.id)}
            />
          ))}
        </ListGroup>
      )}

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent aria-describedby={undefined} onOpenAutoFocus={skipAutoFocusOnTouch}>
          <DialogHeader>
            <DialogTitle>Físico objetivo</DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <PhysiqueImage
                key={editing.image_url}
                src={editing.image_url}
                alt={editing.name}
                className="mx-auto h-48 w-36 rounded-2xl"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPhoto(editing.id, e)}
              />
              <ListGroup inset>
                <ListRow
                  title={<span className="text-primary">{editing.image_url ? "Cambiar foto" : "Subir foto"}</span>}
                  trailing={uploading ? <Spinner size="sm" /> : undefined}
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                />
              </ListGroup>
              <div>
                <Label htmlFor="physique-name" className="mb-1.5 block font-normal text-muted-foreground">
                  Nombre
                </Label>
                <Input
                  id="physique-name"
                  value={editing.name}
                  onChange={(e) => update(editing.id, { name: e.target.value })}
                  placeholder="Físico de referencia"
                  autoCapitalize="words"
                  enterKeyHint="done"
                />
              </div>
              <ListGroup inset footer="Si lo ocultas, los usuarios no lo verán en el AI Scan.">
                <ListRow
                  title="Visible"
                  trailing={
                    <Switch
                      aria-label="Visible"
                      checked={editing.visible}
                      onCheckedChange={(v) => { void hapticSelection(); update(editing.id, { visible: v }); }}
                    />
                  }
                />
              </ListGroup>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={async () => {
                  void hapticTap();
                  if (await save(editing)) setSheetOpen(false);
                }}
              >
                Guardar
              </Button>
              <Button
                type="button"
                variant="plain"
                className="w-full text-destructive"
                onClick={() => {
                  void hapticTap();
                  setDeleteTarget({ id: editing.id, name: editing.name.trim() || "este físico" });
                  setSheetOpen(false);
                  setDeleteOpen(true);
                }}
              >
                Eliminar físico
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar físico</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará {deleteTarget?.name} de los físicos de referencia. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => { if (deleteTarget) void remove(deleteTarget.id); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GoalPhysiquesEditor;
