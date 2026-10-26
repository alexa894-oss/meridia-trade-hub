// Detecta teléfonos, correos o identificadores de WeChat en texto libre.
// Misma lógica que public.find_contact_info() en la base: la interfaz avisa
// antes de enviar y la base lo vuelve a comprobar.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const WECHAT_WORD = /(微信|wechat|weixin|wxid_)[^\n]{0,30}/i;
const WECHAT_PREFIX = /\b(wx|vx)\s*[:：]\s*\S+/i;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;

export function findContactInfo(text: string | null | undefined): string | null {
  if (!text) return null;
  const email = text.match(EMAIL);
  if (email) return email[0];
  const wechat = text.match(WECHAT_WORD) ?? text.match(WECHAT_PREFIX);
  if (wechat) return wechat[0];
  for (const match of text.matchAll(PHONE)) {
    const candidate = match[0];
    const digits = candidate.replace(/\D/g, "").length;
    if (digits < 8 || digits > 15) continue;
    // Se descartan fechas (2026-12-31) y cantidades con punto o coma, salvo que empiece con +.
    if (candidate.startsWith("+") || (!/[.,]/.test(candidate) && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(candidate))) {
      return candidate;
    }
  }
  return null;
}
