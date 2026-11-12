/**
 * The public webhook entry, on the listener `webhook-ingress.ts` mounts: it decides what
 * only an entry can (body limit, read deadline, status table) and asks the Host the rest.
 * @module @contexera/dsh-agent-team/webhook
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name. */
export declare const name = "agent-team-webhook";
/** `webServer` is the ingress realm's own listener; `agentTeam` stays the shared Host. */
export declare const inject: string[];
export declare const apply: (ctx: Context) => void;
//# sourceMappingURL=webhook.d.ts.map