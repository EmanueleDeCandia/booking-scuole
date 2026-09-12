/**
 * Modulo Email per invio notifiche con servizio Resend.
 * Configurazione:
 * - RESEND_API_KEY: Chiave API ricavata da resend.com (formato re_...)
 * - RESEND_FROM_EMAIL: Indirizzo mittente (es. "onboarding@resend.dev" per test, o "prenotazioni@scuoladanza.it" con dominio)
 */

import { formatDayLong, formatHour } from "./agenda";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !apiKey.trim()) {
    console.log(`[EMAIL SIMULATA - RESEND NON CONFIGURATO] A: ${to} | Oggetto: ${subject}`);
    return { success: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Accademia & Scuola Danza <${fromEmail.trim()}>`,
        to: [to.trim()],
        subject,
        html,
        text,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn("[RESEND ERROR]", data);
      return { success: false, error: data.message || "Errore invio email Resend" };
    }

    console.log(`[RESEND SENT] Email inviata con successo a ${to}, id:`, data.id);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[RESEND EXCEPTION]", err);
    return { success: false, error: err.message };
  }
}

export async function sendBookingConfirmationEmail(params: {
  clientName: string;
  clientEmail: string;
  service: string;
  day: string;
  hour: number;
}) {
  if (!params.clientEmail || !params.clientEmail.includes("@")) return;

  const dayFormatted = formatDayLong(params.day);
  const hourFormatted = formatHour(params.hour);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #222; border-radius: 12px; padding: 24px; background-color: #fdfbf7;">
      <h2 style="color: #222; margin-top: 0;">🩰 Prenotazione Confermata!</h2>
      <p>Ciao <strong>${params.clientName}</strong>,</p>
      <p>La tua lezione di <strong>${params.service}</strong> è stata confermata con successo.</p>
      
      <div style="background-color: #fff; border: 1px dashed #222; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0;">📅 <strong>Data:</strong> ${dayFormatted}</p>
        <p style="margin: 4px 0;">⏰ <strong>Orario:</strong> ore ${hourFormatted}</p>
        <p style="margin: 4px 0;">🎭 <strong>Disciplina:</strong> ${params.service}</p>
      </div>

      <p style="font-size: 13px; color: #666;">
        Puoi gestire, visualizzare o spostare questa lezione in qualunque momento accedendo al tuo profilo sull'Agenda Online.
      </p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="font-size: 11px; color: #999; text-align: center;">Accademia di Danza e Discipline Artistiche</p>
    </div>
  `;

  return sendEmail({
    to: params.clientEmail,
    subject: `Conferma Lezione: ${params.service} · ${dayFormatted} ore ${hourFormatted}`,
    html,
  });
}

export async function sendBookingCancellationEmail(params: {
  clientName: string;
  clientEmail: string;
  service: string;
  day: string;
  hour: number;
}) {
  if (!params.clientEmail || !params.clientEmail.includes("@")) return;

  const dayFormatted = formatDayLong(params.day);
  const hourFormatted = formatHour(params.hour);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #222; border-radius: 12px; padding: 24px; background-color: #fdfbf7;">
      <h2 style="color: #c93b2b; margin-top: 0;">✕ Prenotazione Annullata</h2>
      <p>Gentile <strong>${params.clientName}</strong>,</p>
      <p>La prenotazione per la lezione di <strong>${params.service}</strong> del <strong>${dayFormatted} ore ${hourFormatted}</strong> è stata annullata.</p>
      <p style="font-size: 13px; color: #666;">
        Lo slot è tornato disponibile. Puoi prenotare un'altra data o disciplina in qualunque momento dall'Agenda.
      </p>
    </div>
  `;

  return sendEmail({
    to: params.clientEmail,
    subject: `Annullamento Lezione: ${params.service} · ${dayFormatted}`,
    html,
  });
}
