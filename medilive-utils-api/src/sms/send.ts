import type { D1Database } from '@cloudflare/workers-types';
import { SMSAPI } from 'smsapi';

export interface SmsSendResult {
  success: boolean;
  visit?: {
    id: string;
    user_id: string;
    institution_id: string;
    doctor_id: string;
    tenant_id: string;
    phone_number: string;
    email: string;
    sms_sent: boolean;
    sms_skipped: boolean;
  };
  error?: string;
}

/**
 * Check whether ANOTHER visit with this phone_number + tenant_id
 * already exists within the last 24 hours (excluding the current visit).
 */
async function hasRecentDuplicate(
  db: D1Database,
  phoneNumber: string,
  tenantId: string,
  excludeVisitId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM visits
       WHERE phone_number = ?
         AND tenant_id = ?
         AND id != ?
         AND created_at > datetime('now', '-24 hours')
       LIMIT 1`,
    )
    .bind(phoneNumber, tenantId, excludeVisitId)
    .first();
  return row !== null;
}

/**
 * Send SMS for an existing visit.
 *
 * 1. Look up the visit by ID + tenant_id
 * 2. If not found → error
 * 3. Check if another visit with the same phone_number exists in the last 24h
 * 4. If duplicate → UPDATE sms_skipped = 1, skip SMS
 * 5. Otherwise → send SMS, UPDATE sms_sent = 1
 */
export async function sendVisitSms(
  db: D1Database,
  visitId: string,
  tenantId: string,
  smsapi: SMSAPI,
  senderName: string,
): Promise<SmsSendResult> {
  try {
    // Lookup the visit
    const visit = await db
      .prepare(
        `SELECT id, user_id, institution_id, doctor_id, tenant_id, phone_number, email
         FROM visits
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(visitId, tenantId)
      .first<{
        id: string;
        user_id: string;
        institution_id: string;
        doctor_id: string;
        tenant_id: string;
        phone_number: string;
        email: string;
      }>();

    if (!visit) {
      return { success: false, error: 'Visit not found.' };
    }

    if (!visit.phone_number) {
      return { success: false, error: 'Visit has no phone number.' };
    }

    // Check 24h dedup
    const isDuplicate = await hasRecentDuplicate(db, visit.phone_number, tenantId, visitId);

    if (isDuplicate) {
      await db
        .prepare('UPDATE visits SET sms_skipped = 1 WHERE id = ?')
        .bind(visitId)
        .run();

      return {
        success: true,
        visit: {
          id: visit.id,
          user_id: visit.user_id,
          institution_id: visit.institution_id,
          doctor_id: visit.doctor_id,
          tenant_id: visit.tenant_id,
          phone_number: visit.phone_number,
          email: visit.email,
          sms_sent: false,
          sms_skipped: true,
        },
      };
    }

    // Send SMS
    await smsapi.sms.sendSms(
      visit.phone_number,
      `Twoja wizyta została umówiona. Pozdrawiamy, ${senderName}`,
      { from: senderName },
    );

    await db
      .prepare('UPDATE visits SET sms_sent = 1 WHERE id = ?')
      .bind(visitId)
      .run();

    return {
      success: true,
      visit: {
        id: visit.id,
        user_id: visit.user_id,
        institution_id: visit.institution_id,
        doctor_id: visit.doctor_id,
        tenant_id: visit.tenant_id,
        phone_number: visit.phone_number,
        email: visit.email,
        sms_sent: true,
        sms_skipped: false,
      },
    };
  } catch (err) {
    console.error('Failed to send SMS for visit:', err);
    return {
      success: false,
      error: 'Failed to send SMS.',
    };
  }
}