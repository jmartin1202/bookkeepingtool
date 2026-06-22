import "server-only";

type SendReminderEmailInput = {
  to: string;
  clientName: string;
  organizationName: string;
  periodLabel: string;
  dueDateLabel: string;
  uploadUrl: string;
  missingItems: string[];
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function getReminderFromAddress() {
  return process.env.REMINDER_EMAIL_FROM ?? "Month-End Chaser <onboarding@resend.dev>";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendReminderEmail(input: SendReminderEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const missingListText = input.missingItems.map((item) => `- ${item}`).join("\n");
  const missingListHtml = input.missingItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const subject = `${input.periodLabel} documents requested by ${input.organizationName}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getReminderFromAddress(),
      to: [input.to],
      subject,
      text: [
        `Hi ${input.clientName},`,
        "",
        `${input.organizationName} is still waiting on these ${input.periodLabel} documents:`,
        "",
        missingListText,
        "",
        `Due date: ${input.dueDateLabel}`,
        "",
        `Upload them here: ${input.uploadUrl}`,
        "",
        "Thank you.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #17211d; line-height: 1.55;">
          <p>Hi ${escapeHtml(input.clientName)},</p>
          <p>${escapeHtml(input.organizationName)} is still waiting on these ${escapeHtml(
            input.periodLabel,
          )} documents:</p>
          <ul>${missingListHtml}</ul>
          <p><strong>Due date:</strong> ${escapeHtml(input.dueDateLabel)}</p>
          <p>
            <a href="${escapeHtml(input.uploadUrl)}" style="background:#173f35;color:#ffffff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block;">
              Upload documents
            </a>
          </p>
          <p>Thank you.</p>
        </div>
      `,
    }),
  });

  const responseBody = (await response.json().catch(() => ({}))) as ResendResponse;

  if (!response.ok) {
    throw new Error(responseBody.message ?? responseBody.name ?? "Reminder email failed");
  }

  return responseBody.id ?? "sent";
}
