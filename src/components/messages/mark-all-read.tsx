"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/lib/messages/actions";

// Al abrir la página de avisos, quedan leídos y se actualiza la campana.
export function MarkAllRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!hasUnread) return;
    markAllNotificationsRead().then(() => router.refresh());
  }, [hasUnread, router]);
  return null;
}
