import type { D1Database } from '@cloudflare/workers-types';

export interface CreateVisitParams {
  userId: string;
  institutionId: string;
  doctorId: string;
  type: string;
  phoneNumber?: string;
  email?: string;
  tenantId: string;
}

export interface CreateVisitSuccess {
  success: true;
  visit: {
    id: string;
    user_id: string;
    institution_id: string;
    doctor_id: string;
    tenant_id: string;
    phone_number: string;
    email: string;
    type: string;
  };
}

export interface CreateVisitError {
  success: false;
  error: string;
}

export type CreateVisitResult = CreateVisitSuccess | CreateVisitError;

/**
 * Create a new visit record in the D1 database.
 */
export async function createVisit(
  db: D1Database,
  params: CreateVisitParams,
): Promise<CreateVisitResult> {
  const visitId = crypto.randomUUID();

  try {
    const email = params.email ?? '';
    const phone_number = params.phoneNumber ?? '';
    const type = params.type ?? '';

    await db
      .prepare(
        'INSERT INTO visits (id, user_id, institution_id, doctor_id, tenant_id, phone_number, email, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(visitId, params.userId, params.institutionId, params.doctorId, params.tenantId, phone_number, email, type)
      .run();

    return {
      success: true,
      visit: {
        id: visitId,
        user_id: params.userId,
        institution_id: params.institutionId,
        doctor_id: params.doctorId,
        tenant_id: params.tenantId,
        phone_number,
        email,
        type,
      },
    };
  } catch (err) {
    console.error('Failed to create visit:', err);
    return {
      success: false,
      error: 'Failed to create visit record.',
    };
  }
}