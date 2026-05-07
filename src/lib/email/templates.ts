const FROM_DEFAULT = 'Miss Diaspora Ghana <applications@missdiasporagh.org>';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderMagicLinkEmail(args: { reference: string; magicLink: string; cycleClose: string }) {
  const { reference, magicLink, cycleClose } = args;
  return {
    subject: 'Your MDGH application link',
    text: [
      `Welcome — your MDGH application slot is reserved.`,
      ``,
      `Reference: ${reference}`,
      `Application link (valid until ${cycleClose}):`,
      magicLink,
      ``,
      `Open this link to fill out your application. You can return to it any time before the cycle closes.`,
      ``,
      `If you didn't initiate this application, ignore this email.`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0d0d0d;color:#eee;padding:24px">
<h1 style="font-family:Georgia,serif;color:#F8B92F">Welcome to MDGH</h1>
<p>Your application slot is reserved.</p>
<p>Reference: <code style="color:#F8B92F">${escapeHtml(reference)}</code></p>
<p><a href="${escapeHtml(magicLink)}" style="display:inline-block;padding:12px 20px;background:#F8B92F;color:#000;text-decoration:none;border-radius:8px;font-weight:bold">Open my application</a></p>
<p style="font-size:13px;opacity:0.7">Link valid until ${escapeHtml(cycleClose)}. You can return to it any time before the cycle closes.</p>
<p style="font-size:11px;opacity:0.5">If you didn't initiate this application, ignore this email.</p>
</body></html>`,
  };
}

export function renderApplicantConfirmation(args: { fullName: string; reference: string }) {
  const { fullName, reference } = args;
  return {
    subject: "We've received your MDGH application",
    text: [
      `Hi ${fullName},`,
      ``,
      `Your MDGH application has been received. We'll be in touch within 14 days.`,
      ``,
      `Reference: ${reference}`,
      ``,
      `Your data is retained for 3 years post-cycle, then deleted, per our Privacy Policy.`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0d0d0d;color:#eee;padding:24px">
<h1 style="font-family:Georgia,serif;color:#F8B92F">Application received</h1>
<p>Hi ${escapeHtml(fullName)}, your MDGH application has been received.</p>
<p>Reference: <code style="color:#F8B92F">${escapeHtml(reference)}</code></p>
<p>We'll be in touch within 14 days.</p>
<p style="font-size:11px;opacity:0.5">Your data is retained for 3 years post-cycle, then deleted, per our Privacy Policy.</p>
</body></html>`,
  };
}

export function renderAdminNotification(args: { fullName: string; reference: string; dashboardUrl: string }) {
  const { fullName, reference, dashboardUrl } = args;
  return {
    subject: `[MDGH] New application: ${fullName} (${reference})`,
    text: [
      `New MDGH application submitted.`,
      ``,
      `Name: ${fullName}`,
      `Reference: ${reference}`,
      ``,
      `Review: ${dashboardUrl}`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif">
<h2>New MDGH application</h2>
<p><strong>${escapeHtml(fullName)}</strong> &middot; ${escapeHtml(reference)}</p>
<p><a href="${escapeHtml(dashboardUrl)}">Open in admin dashboard</a></p>
</body></html>`,
  };
}

export function renderRecoveryEmail(args: { reference: string; magicLink: string; cycleClose: string }) {
  const out = renderMagicLinkEmail(args);
  return { ...out, subject: 'Your MDGH application link (resent)' };
}

export const FROM_ADDRESS = FROM_DEFAULT;
