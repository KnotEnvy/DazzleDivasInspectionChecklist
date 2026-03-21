const RESEND_API_URL = "https://api.resend.com/emails";

function requireEnvValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function buildPasswordSetupEmail(params: {
  inviteUrl: string;
  recipientEmail: string;
  recipientName?: string;
  expires: Date;
}) {
  const recipientName = params.recipientName?.trim() || "there";
  const expiresLabel = params.expires.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return {
    subject: "Set your Dazzle Divas password",
    text: [
      `Hi ${recipientName},`,
      "",
      "Your Dazzle Divas Field Checklist account is ready.",
      "Use the link below to set your password and finish signing in:",
      params.inviteUrl,
      "",
      `This link expires on ${expiresLabel}.`,
      "If you did not expect this invite, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto;">
        <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase; color: #be185d; margin-bottom: 8px;">
          Dazzle Divas
        </p>
        <h1 style="font-size: 28px; margin: 0 0 12px;">Set your password</h1>
        <p style="margin: 0 0 16px;">Hi ${recipientName},</p>
        <p style="margin: 0 0 16px;">
          Your Dazzle Divas Field Checklist account is ready. Use the button below to set your password and finish signing in.
        </p>
        <p style="margin: 24px 0;">
          <a
            href="${params.inviteUrl}"
            style="display: inline-block; background: #be185d; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 12px; font-weight: 700;"
          >
            Set Password
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">If the button does not work, open this link:</p>
        <p style="margin: 0 0 16px; word-break: break-word; font-size: 14px; color: #0f172a;">${params.inviteUrl}</p>
        <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">This link expires on ${expiresLabel}.</p>
        <p style="margin: 0; font-size: 14px; color: #475569;">If you did not expect this invite, you can ignore this email.</p>
      </div>
    `,
  };
}

export async function sendPasswordSetupEmail(params: {
  inviteUrl: string;
  recipientEmail: string;
  recipientName?: string;
  expires: Date;
}) {
  const apiKey = requireEnvValue("RESEND_API_KEY");
  const from = requireEnvValue("RESEND_FROM_EMAIL");
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim();
  const email = buildPasswordSetupEmail(params);

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.recipientEmail],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to send onboarding email (${response.status}): ${details}`);
  }
}
