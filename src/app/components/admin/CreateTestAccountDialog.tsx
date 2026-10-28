import { useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { Input } from "@/shared/components/ui/input";
import { ListGroup } from "@/shared/components/ui/list";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import type { Profile } from "@/app/pages/Admin";
import { Field, FieldRow } from "@/app/components/admin/AdminOpsParts";

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
  const isMobile = useIsMobile();
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
      void hapticNotify("success");
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
        <Button variant="plain" className="gap-1.5 px-0">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Crear cuenta de prueba
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onOpenAutoFocus={isMobile ? (event) => event.preventDefault() : undefined}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Cuenta lista para probar</DialogTitle>
              <DialogDescription>
                Ya aparece en la lista de usuarios. Guarda estas credenciales; la contraseña solo se muestra ahora.
              </DialogDescription>
            </DialogHeader>
            <ListGroup inset>
              <FieldRow label="Tipo">
                <p className="type-body">{ACCOUNT_KIND_LABELS[created.kind]}</p>
              </FieldRow>
              <FieldRow label="Email">
                <p className="break-all type-body selectable">{created.profile.email}</p>
              </FieldRow>
              <FieldRow label="Contraseña">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono type-footnote selectable">{created.password}</code>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="-my-2 -mr-3 shrink-0"
                    onClick={() => { void hapticTap(); void copyPassword(); }}
                    aria-label="Copiar contraseña"
                  >
                    {copied ? <Check className="h-4 w-4 text-success" strokeWidth={2.5} /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </FieldRow>
            </ListGroup>
            <DialogFooter>
              <Button type="button" variant="plain" className="w-full sm:w-auto" onClick={() => { reset(); }}>
                Crear otra
              </Button>
              <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => setOpen(false)}>Listo</Button>
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
            <div className="space-y-4">
              <Field label="Email" htmlFor="test-account-email">
                <Input
                  id="test-account-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="prueba@ejemplo.com"
                />
              </Field>
              <Field label="Nombre (opcional)" htmlFor="test-account-name">
                <Input
                  id="test-account-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Cuenta de pruebas"
                  maxLength={80}
                  autoCapitalize="words"
                  enterKeyHint="done"
                />
              </Field>
              <Field label="Tipo de cuenta" htmlFor="test-account-kind">
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
              </Field>
            </div>
            <DialogFooter>
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={creating || !email.trim()}>
                {creating && <Spinner size="sm" className="text-primary-foreground" />}
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
