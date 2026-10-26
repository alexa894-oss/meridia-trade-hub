import { Suspense } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import { signOut } from "@/app/[locale]/(auth)/actions";
import { unreadNotificationCount } from "@/lib/messages/load";
import { NotificationBell } from "@/components/messages/notification-bell";

export function AppHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/panel" className="flex items-center gap-2.5">
          <Image src="/brand/meridia-mark.png" alt="" width={37} height={30} className="h-[30px] w-auto" />
          <span className="font-display text-base leading-none font-bold tracking-wide text-navy-700">
            MERIDIA
            <span className="block text-[0.55rem] font-semibold tracking-[0.3em] text-gold-600">TRADE HUB</span>
          </span>
        </Link>
        <Suspense fallback={<span className="h-9 w-24 animate-pulse rounded bg-navy-50" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function UserMenu() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const [t, unread] = await Promise.all([getTranslations("App"), unreadNotificationCount(profile.id)]);

  return (
    <div className="flex items-center gap-3">
      {/* key: al cambiar el conteo del servidor (p. ej. tras leer avisos) la campana se reinicia */}
      <NotificationBell key={unread} userId={profile.id} initialCount={unread} />
      <Link href={roleHome[profile.role]} className="hidden text-right sm:block">
        <span className="block text-sm font-semibold text-navy-800">{profile.fullName ?? profile.email}</span>
        <span className="block text-xs text-ink-muted">{t(`roles.${profile.role}`)}</span>
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="min-h-10 rounded-(--radius-control) border border-line px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50"
        >
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}
