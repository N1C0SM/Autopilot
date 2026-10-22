import { useEffect, useState } from "react";
import { Bell, BellOff, CalendarSync, Dumbbell, Inbox, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import { skipAutoFocusOnTouch } from "@/components/user-core/skipAutoFocusOnTouch";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Props {
  userId: string;
}

const NotificationsBell = ({ userId }: Props) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data as unknown as Notification[]);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  // Iconos informativos: en gris; el dorado queda para lo seleccionado y la acción.
  const typeIcon = (type: string) => {
    switch (type) {
      case "plan_renewed": return <CalendarSync className="text-muted-foreground" />;
      case "macros_adjusted": return <Target className="text-muted-foreground" />;
      case "reminder": return <Dumbbell className="text-muted-foreground" />;
      default: return <Inbox className="text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 hover:bg-transparent"
          aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
          onClick={() => void hapticTap()}
        >
          {/* Mismo círculo que el avatar: todos los botones de la barra hablan igual. */}
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary">
            <Bell className="h-[17px] w-[17px]" strokeWidth={2.25} aria-hidden="true" />
          </span>
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 type-caption2 font-bold tabular-nums text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="min-h-[50dvh] sm:mx-auto sm:max-w-md" onOpenAutoFocus={skipAutoFocusOnTouch}>
        <SheetHeader>
          <SheetTitle>Notificaciones</SheetTitle>
          <SheetDescription className="sr-only">Tus avisos recientes</SheetDescription>
        </SheetHeader>
        {notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Sin notificaciones"
            description="Aquí verás los cambios en tu plan y los recordatorios."
            className="py-16"
          />
        ) : (
          <ListGroup inset className="mt-4">
            {notifications.map((n) => (
              <ListRow
                key={n.id}
                icon={typeIcon(n.type)}
                title={n.title}
                subtitle={n.message}
                value={timeAgo(n.created_at)}
              />
            ))}
          </ListGroup>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default NotificationsBell;
