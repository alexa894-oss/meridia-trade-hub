import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Textos vigentes que el usuario todavía no aceptó. Solo obliga a quien ya había
// aceptado una versión anterior: quien está registrándose los acepta al enviar.
export const loadPendingLegal = cache(async (userId: string) => {
  const supabase = await createClient();
  const [pending, previous] = await Promise.all([
    supabase.rpc("pending_legal_documents"),
    supabase.from("legal_acceptances").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return { documents: pending.data ?? [], mustAccept: (pending.data?.length ?? 0) > 0 && (previous.count ?? 0) > 0 };
});
