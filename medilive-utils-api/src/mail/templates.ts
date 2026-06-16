// ── shadcn/ui Color Palette (CSS-inlined for email compatibility) ──
// These colors mirror the shadcn/ui default theme tokens.
const colors = {
  background: '#ffffff',
  foreground: '#0f172a',
  primary: '#18181b', // zinc-900 — used for headings, buttons
  primaryForeground: '#fafafa', // zinc-50 — button/label text
  muted: '#f1f5f9', // slate-100 — subtle backgrounds
  mutedForeground: '#64748b', // slate-500 — secondary text
  border: '#e2e8f0', // slate-200 — dividers, card borders
  card: '#ffffff',
  destructive: '#ef4444',
} as const;

// ── Email Container Styles ──
const containerStyles = [
  `background-color: ${colors.background};`,
  'max-width: 560px;',
  'margin: 0 auto;',
  `border: 1px solid ${colors.border};`,
  'border-radius: 12px;',
  'overflow: hidden;',
  'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
].join('');

const bodyStyles = [
  'padding: 40px 32px;',
  `color: ${colors.foreground};`,
  'font-size: 16px;',
  'line-height: 1.6;',
].join('');

const headingStyles = (size: 'lg' | 'md'): string => {
  const base = [
    `color: ${colors.foreground};`,
    'font-weight: 700;',
    'margin: 0 0 12px 0;',
  ];
  if (size === 'lg') {
    base.push('font-size: 24px;');
  } else {
    base.push('font-size: 18px;');
  }
  return base.join('');
};

const ctaButtonStyles = [
  `background-color: ${colors.primary};`,
  `color: ${colors.primaryForeground};`,
  'display: inline-block;',
  'padding: 12px 28px;',
  'border-radius: 8px;',
  'text-decoration: none;',
  'font-weight: 600;',
  'font-size: 15px;',
  'margin-top: 20px;',
  'margin-bottom: 4px;',
].join('');

const footerStyles = [
  'padding: 20px 32px;',
  `background-color: ${colors.muted};`,
  `color: ${colors.mutedForeground};`,
  'font-size: 13px;',
  'text-align: center;',
  `border-top: 1px solid ${colors.border};`,
].join('');

const dividerStyles = [
  `border: none;`,
  `border-top: 1px solid ${colors.border};`,
  'margin: 24px 0;',
].join('');

const textContentStyles = [
  `color: ${colors.mutedForeground};`,
  'font-size: 16px;',
  'line-height: 1.7;',
  'margin: 16px 0;',
].join('');

// ── Template Builder ──
export interface TemplateData {
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  senderName: string;
}

/**
 * Build a shadcn-themed HTML email template.
 */
export function buildHtmlTemplate(data: TemplateData): string {
  const ctaSection = data.ctaText && data.ctaUrl
    ? `
      <a href="${escapeHtml(data.ctaUrl)}" style="${ctaButtonStyles}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(data.ctaText)}
      </a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.muted};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background-color: ${colors.muted}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="${containerStyles}">
          <!-- Content Area -->
          <tr>
            <td style="${bodyStyles}">
              <h1 style="${headingStyles('lg')}">${escapeHtml(data.title)}</h1>
              <hr style="${dividerStyles}" />
              <div style="${textContentStyles}">
                ${escapeHtmlPreserveBreaks(data.body)}
              </div>
              ${ctaSection}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="${footerStyles}">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: ${colors.foreground};">
                ${escapeHtml(data.senderName)}
              </p>
              <p style="margin: 0;">
                This is a transactional message. Replies to this email are not monitored.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build a plaintext fallback version.
 */
export function buildTextTemplate(data: TemplateData): string {
  let text = `${data.title}\n\n`;
  text += `${'-'.repeat(data.title.length)}\n\n`;
  text += `${data.body}\n\n`;

  if (data.ctaText && data.ctaUrl) {
    text += `${data.ctaText} — ${data.ctaUrl}\n\n`;
  }

  text += `Sent by ${data.senderName}\n`;
  text += `This is a transactional message. Replies to this email are not monitored.\n`;

  return text;
}

// ── HTML-safety: escape user-provided text ──
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Escape HTML while preserving newlines as <br> tags.
 * The body text comes from user input and may contain multi-line content.
 */
function escapeHtmlPreserveBreaks(str: string): string {
  return str
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br />');
}