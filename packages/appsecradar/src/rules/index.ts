import type { Rule } from "../types.js";
import { apiRouteMissingAuth } from "./api-route-missing-auth.js";
import { corsAnyOriginCredentials } from "./cors-any-origin-credentials.js";
import { debugModeEnabled } from "./debug-mode-enabled.js";
import { firebaseOpenRules } from "./firebase-open-rules.js";
import { hardcodedSecret } from "./hardcoded-secret.js";
import { publicEnvSecret } from "./public-env-secret.js";
import { sqlInjection } from "./sql-injection.js";
import { stripeWebhookUnverified } from "./stripe-webhook-unverified.js";
import { supabaseRlsDisabled } from "./supabase-rls-disabled.js";

export const rules: Rule[] = [
  hardcodedSecret,
  publicEnvSecret,
  supabaseRlsDisabled,
  firebaseOpenRules,
  stripeWebhookUnverified,
  apiRouteMissingAuth,
  sqlInjection,
  corsAnyOriginCredentials,
  debugModeEnabled,
];
