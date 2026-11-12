/**
 * The public webhook entry's own listener: a second `@deepseek-ai/dsh-host-webserver`, in an
 * isolated `webServer` realm so a provider that reaches this port never touches the browser
 * API. It is mounted here, as a child of this row, instead of named as a composition row:
 * Harness protects that module, and a bundle naming a protected module cannot be disabled
 * again at runtime. docs/architecture/host-authority.md explains the consequence.
 * @module @contexera/dsh-agent-team/webhook-ingress
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name. */
export declare const name = "agent-team-webhook-ingress";
/** Nothing to wait for: the route this mounts asks for `agentTeam` and `webServer` itself. */
export declare const inject: readonly string[];
export interface Config {
    /** A concrete local address; a tunnel publishes it. */
    host: string;
    /** The published port; `0` lets the operating system choose one. */
    port: number;
}
export declare const Config: z<Config>;
/** Mount the listener and the route into this row's own realm. */
export declare const apply: (ctx: Context, config: Config) => Promise<void>;
//# sourceMappingURL=webhook-ingress.d.ts.map