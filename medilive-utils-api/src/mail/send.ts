import type { Env, EmailErrorCode, SendMailErrorResponse, SendMailSuccessResponse } from '../types';
import type { SendMailRequest } from '../types';
import { buildHtmlTemplate, buildTextTemplate } from './templates';

/**
 * Human-readable error messages for common Cloudflare Email error codes.
 */
const EMAIL_ERROR_MESSAGES: Record<EmailErrorCode, string> = {
  E_VALIDATION_ERROR: 'The email request contains invalid data.',
  E_FIELD_MISSING: 'A required email field (to, from, or subject) is missing.',
  E_TOO_MANY_RECIPIENTS: 'Too many recipients. Maximum is 50 combined (to + cc + bcc).',
  E_SENDER_NOT_VERIFIED: 'The sender domain has not been onboarded to Email Sending.',
  E_RECIPIENT_NOT_ALLOWED: 'The recipient address is not in the allowed destination list.',
  E_RECIPIENT_SUPPRESSED: 'The recipient has bounced or reported spam previously.',
  E_SENDER_DOMAIN_NOT_AVAILABLE: 'The sender domain is not available for sending.',
  E_CONTENT_TOO_LARGE: 'The email content exceeds the 25 MiB size limit.',
  E_RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please retry later.',
  E_DAILY_LIMIT_EXCEEDED: 'Daily email quota exceeded.',
  E_DELIVERY_FAILED: 'SMTP delivery to the recipient failed.',
  E_INTERNAL_SERVER_ERROR: 'Email service temporarily unavailable.',
  E_HEADER_NOT_ALLOWED: 'A custom header is not on the allowed list.',
  E_HEADER_USE_API_FIELD: 'A header must be set via the dedicated API field instead.',
  E_HEADER_VALUE_INVALID: 'A header value is malformed or empty.',
  E_HEADER_VALUE_TOO_LONG: 'A header value exceeds 2,048 bytes.',
  E_HEADER_NAME_INVALID: 'A header name contains invalid characters or is too long.',
  E_HEADERS_TOO_LARGE: 'Total headers exceed the 16 KB limit.',
  E_HEADERS_TOO_MANY: 'More than 20 custom (non-X-) headers were provided.',
};

/**
 * Determine whether a retry is appropriate for this error code.
 */
function isRetryable(code: string): boolean {
  return code === 'E_RATE_LIMIT_EXCEEDED' || code === 'E_INTERNAL_SERVER_ERROR' || code === 'E_DELIVERY_FAILED';
}

/**
 * Send a transactional email using the Cloudflare Email Workers binding.
 *
 * Returns success response with messageId, or error response with details.
 */
export async function sendEmail(
  request: SendMailRequest,
  env: Env,
  senderEmail: string,
  defaultSenderName: string,
): Promise<SendMailSuccessResponse | SendMailErrorResponse> {
  const senderName = request.senderName || defaultSenderName;

  const templateData = {
    title: request.content.title,
    body: request.content.body,
    ctaText: request.content.ctaText,
    ctaUrl: request.content.ctaUrl,
    senderName,
  };

  const html = buildHtmlTemplate(templateData);
  const text = buildTextTemplate(templateData);

  try {
    const result = await env.EMAIL.send({
      to: request.to,
      from: { email: senderEmail, name: senderName },
      subject: request.subject,
      html,
      text,
    });

    console.log(`Email sent successfully to ${request.to}, messageId: ${result.messageId}`);

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: unknown) {
    // Extract error code and message from the Cloudflare Email binding error
    const err = error as { code?: string; message?: string };
    const code = (err.code as EmailErrorCode) || 'E_INTERNAL_SERVER_ERROR';
    const humanMessage = EMAIL_ERROR_MESSAGES[code] || err.message || 'Unknown email sending error';

    console.error(`Email send failed to ${request.to}: [${code}] ${humanMessage}`);

    return {
      success: false,
      error: humanMessage,
      code,
    };
  }
}