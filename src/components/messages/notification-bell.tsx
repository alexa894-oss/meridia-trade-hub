"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Campana con el número de avisos sin leer; se actualiza en tiempo real.
export function NotificationBell({ userId, initialCount }: { userId: string; initialCount: number }) {
  const t = useTranslations("Notifications");
  const [count, setCount] = useState(initialCount);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () =>
        setCount((c) => c + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return (
    <Link
      href="/notificaciones"
      aria-label={t("bell", { count })}
      className="relative inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-line text-navy-800 hover:bg-navy-50"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-gold-500 px-1 text-center text-xs leading-5 font-bold text-navy-900">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
