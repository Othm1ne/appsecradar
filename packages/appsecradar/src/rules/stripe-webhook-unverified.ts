import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule } from "../types.js";

const STRIPE_EVENT =
  /["'`](checkout\.session\.completed|invoice\.(?:paid|payment_succeeded)|customer\.subscription\.\w+|payment_intent\.succeeded|charge\.succeeded)["'`]/;

// JS constructEvent, Python/Ruby construct_event, PHP Webhook::constructEvent, Go webhook.ConstructEvent.
const VERIFIED = /construct_?event(?:Async)?\s*\(|ConstructEvent\w*\s*\(|webhooks?\.signature|verify_?header/i;

export const stripeWebhookUnverified: Rule = {
  id: "stripe-webhook-unverified",
  title: "Stripe webhook does not verify the signature",
  description:
    "Without signature verification anyone can POST a fake 'payment succeeded' event and get paid features for free.",
  check(project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      if (/\.(sql|json|ya?ml|toml|md)$/.test(file.path)) continue;
      const event = STRIPE_EVENT.exec(file.content);
      if (!event) continue;
      if (VERIFIED.test(file.content)) continue;
      const line = lineOf(file.content, event.index);
      if (isIgnored(file.content, line)) continue;
      findings.push({
        ruleId: this.id,
        severity: "critical",
        title: "Stripe webhook accepts unsigned events",
        file: file.path,
        line,
        message:
          `This handler reacts to "${event[1]}" but never verifies the Stripe signature (constructEvent / construct_event). ` +
          `An attacker can send a fake event to this URL and unlock paid plans without paying.`,
        fixPrompt:
          `The Stripe webhook handler in ${file.path} trusts the request body without verifying it. ` +
          `Read the raw, unparsed request body and the "Stripe-Signature" header, and verify them with the Stripe SDK's ` +
          `webhook helper using the STRIPE_WEBHOOK_SECRET env variable (constructEvent in Node, stripe.Webhook.construct_event in Python, ` +
          `\\Stripe\\Webhook::constructEvent in PHP, webhook.ConstructEvent in Go). ` +
          `Return 400 if verification throws. Only use the verified event object afterwards.`,
      });
    }
    return findings;
  },
};
