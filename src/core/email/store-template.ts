export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

type StoreEmail = { appUrl: string; title: string; preview: string; firstName?: string | null; body: string; action: { label: string; url: string }; text: string };

export function storeEmail(input: StoreEmail) {
  const store = new URL(input.appUrl);
  const logo = new URL(process.env.EMAIL_LOGO_URL || '/Asset%201%20(1).png', store);
  if (!['https:', 'http:'].includes(logo.protocol)) throw new Error('Invalid email logo URL');
  const greeting = input.firstName ? `Hello ${input.firstName},` : 'Hello,';
  const e = escapeHtml;
  return {
    text: `${greeting}\n\n${input.text}\n\n${input.action.label}: ${input.action.url}\n\nSAGI · Culinary Boutique\nVisit the store: ${store.origin}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(input.title)}</title></head>
<body style="margin:0;padding:0;background:#FFFFFF;color:#000000;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${e(input.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:16px;overflow:hidden">
<tr><td align="center" style="padding:36px 24px 28px;border-bottom:1px solid #E5E5E5"><a href="${e(store.origin)}"><img src="${e(logo.href)}" alt="SAGI" width="150" height="41" style="display:block;width:150px;height:auto;border:0;color:#000000;font: bold 32px Georgia,serif"></a><p style="margin:12px 0 0;font-size:10px;letter-spacing:3px;color:#525252;text-transform:uppercase">Culinary Boutique</p></td></tr>
<tr><td style="padding:32px 24px"><p style="margin:0 0 12px;font-size:10px;letter-spacing:2px;color:#525252;text-transform:uppercase">Thoughtfully selected. Made to savour.</p><h1 style="margin:0 0 24px;font:normal 32px/1.2 Georgia,'Times New Roman',serif;color:#000000">${e(input.title)}</h1><p style="font-size:15px;line-height:24px">${e(greeting)}</p>
${input.body}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 20px"><tr><td bgcolor="#000000" style="border-radius:6px;mso-padding-alt:16px 24px"><a href="${e(input.action.url)}" style="display:inline-block;padding:16px 24px;color:#FFFFFF;font-size:13px;font-weight:bold;text-decoration:none;border:1px solid #000000;border-radius:6px">${e(input.action.label)} &rarr;</a></td></tr></table>
<p style="font-size:11px;line-height:18px;color:#737373;overflow-wrap:anywhere;word-break:break-all">Button not working? <a href="${e(input.action.url)}" style="color:#525252;text-decoration:underline">${e(input.action.url)}</a></p>
</td></tr><tr><td style="padding:24px;background:#FFFFFF;border-top:1px solid #D4D4D4"><p style="margin:0;font:normal 19px Georgia,serif">Thank you for choosing SAGI.</p><p style="margin:10px 0 0;font-size:12px;line-height:20px;color:#525252">A little heritage in every pantry.</p></td></tr></table>
<p style="margin:20px 0 0;font-size:11px;line-height:20px;color:#737373">SAGI · Canada · &copy; ${new Date().getFullYear()}<br>This is a service email about your SAGI account or order.<br><a href="${e(store.origin)}" style="color:#525252">Visit the store</a></p>
</td></tr></table></body></html>`,
  };
}

export const emailParagraph = (text: string) => `<p style="font-size:15px;line-height:25px;color:#525252;margin:0 0 18px">${escapeHtml(text)}</p>`;
