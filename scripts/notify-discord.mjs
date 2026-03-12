const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
  console.log("[notify-discord] DISCORD_WEBHOOK_URL is not set. Skip.");
  process.exit(0);
}

const status = (process.env.JOB_STATUS || "unknown").toLowerCase();
const rateLimited = (process.env.RATE_LIMITED || "false").toLowerCase() === "true";
const username = process.env.DISCORD_USERNAME || "jquants-metrics";
const workflow = process.env.GITHUB_WORKFLOW || "unknown";
const job = process.env.GITHUB_JOB || "unknown";
const repository = process.env.GITHUB_REPOSITORY || "unknown";
const refName = process.env.GITHUB_REF_NAME || "unknown";
const actor = process.env.GITHUB_ACTOR || "unknown";
const eventName = process.env.GITHUB_EVENT_NAME || "unknown";
const runId = process.env.GITHUB_RUN_ID || "";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const runUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : "";

const statusEmoji =
  status === "success" ? "✅" : status === "failure" ? "❌" : status === "cancelled" ? "⚪" : "ℹ️";
const rateLimitText = rateLimited ? "⚠️ 429 detected in logs" : "No 429 detected";
const color = status === "success" ? 0x2ea043 : status === "failure" ? 0xd73a49 : 0x6e7781;

const payload = {
  username,
  embeds: [
    {
      title: `${statusEmoji} ${workflow} / ${job}`,
      color,
      fields: [
        { name: "Repository", value: repository, inline: true },
        { name: "Ref", value: refName, inline: true },
        { name: "Event", value: eventName, inline: true },
        { name: "Actor", value: actor, inline: true },
        { name: "Status", value: status, inline: true },
        { name: "429", value: rateLimitText, inline: true },
      ],
      url: runUrl || undefined,
      timestamp: new Date().toISOString(),
    },
  ],
};

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`[notify-discord] Failed: ${response.status} ${text}`);
}

console.log(`[notify-discord] sent status=${status} rate_limited=${rateLimited}`);
