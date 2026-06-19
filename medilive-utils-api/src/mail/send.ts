import nodemailer from 'nodemailer';
import type { SendMailErrorResponse, SendMailSuccessResponse } from '../types';
import type { SendMailRequest } from '../types';
import { buildHtmlTemplate, buildTextTemplate } from './templates';

/**
 * Send a transactional email using Amazon SES SMTP via nodemailer.
 */
export async function sendEmail(
  request: SendMailRequest,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPass: string,
): Promise<SendMailSuccessResponse | SendMailErrorResponse> {
  const templateData = {
    title: request.content.title,
    body: request.content.body,
    ctaText: request.content.ctaText,
    ctaUrl: request.content.ctaUrl,
    senderName: request.senderName,
  };

  const html = buildHtmlTemplate(templateData);
  const text = buildTextTemplate(templateData);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `${request.senderName} <${request.senderEmail}>`,
      to: request.to,
      subject: request.subject,
      html,
      text,
    });

    console.log(`Email sent successfully to ${request.to}, messageId: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.error(`Email send failed to ${request.to}: [${err.name}] ${err.message}`);

    return {
      success: false,
      error: err.message || 'Unknown email sending error',
      code: err.name,
    };
  }
}