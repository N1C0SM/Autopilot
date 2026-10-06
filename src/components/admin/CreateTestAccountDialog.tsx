import { useState } from "react";
import { Check, Copy, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Profile } from "@/pages/Admin";

export type TestAccountKind = "client_training" | "client_full" | "client_transform" | "trainer" | "admin";

interface CreatedTestAccount {
  profile: Profile;
  kind: TestAccountKind;
  password: string;
}

interface Props {
  onCreated: (profile: Profile, kind: TestAccountKind) => void;
}

const ACCOUNT_KIND_LABELS: Record<TestAccountKind, string> = {
  client_training: "Cliente · Entrenamiento",
  client_full: "Cliente · Completo",
  client_transform: "Cliente · Transformación",
  trainer: "Entrenador",
  admin: "Administrador",
};

const CreateTestAccountDialog = ({ onCreated }: Props) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TestAccountKind>("client_full");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedTestAccount | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setKind("client_full");
    setCreated(null);
    setCopied(false);
  };

  const createAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-test-account", {
        body: { email: email.trim(), name: name.trim(), kind },
      });
      if (error || !data?.profile || !data?.password) {
        toast.error(data?.error || error?.message || "No se pudo crear la cuenta de prueba.");
        return;
      }

      const profile = data.profile as Profile;
      onCreated(profile, kind);
      setCreated({ profile, kind, password: data.password as string });
      toast.success("Cuenta de prueba creada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo conectar para crear la cuenta.");
    } finally {
      setCreating(false);
    }
  };

  const copyPassword = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      setCopied(true);
      toast.success("Contraseña copiada");
    } catch {
      toast.error("No se pudo copiar. Selecciona la contraseña y cópiala manualmente.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Crear cuenta de prueba
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Cuenta lista para probar</DialogTitle>
              <DialogDescription>
                Ya aparece en la lista de usuarios. Guarda estas credenciales; la contraseña solo se muestra ahora.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
              <div><span className="text-muted-foreground">Tipo: </span>{ACCOUNT_KIND_LABELS[created.kind]}</div>
              <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{created.profile.email}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">Contraseña:</span>
                <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1">{created.password}</code>
                <Button type="button" size="icon" variant="outline" onClick={copyPassword} aria-label="Copiar contraseña">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); }}>
                <UserPlus className="w-4 h-4 mr-2" /> Crear otra
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={createAccount} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Crear cuenta de prueba</DialogTitle>
              <DialogDescription>
                Crea una cuenta lista para iniciar sesión. No se envía ningún correo ni se realiza ningún cobro.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="test-account-email">Email</Label>
                <Input
                  id="test-account-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="prueba@ejemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="test-account-name">Nombre (opcional)</Label>
                <Input
                  id="test-account-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Cuenta de pruebas"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="test-account-kind">Tipo de cuenta</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as TestAccountKind)}>
                  <SelectTrigger id="test-account-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_training">Cliente · Entrenamiento</SelectItem>
                    <SelectItem value="client_full">Cliente · Completo</SelectItem>
                    <SelectItem value="client_transform">Cliente · Transformación 12 semanas</SelectItem>
                    <SelectItem value="trainer">Entrenador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating || !email.trim()}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Crear cuenta
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTestAccountDialog;
