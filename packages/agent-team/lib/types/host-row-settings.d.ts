/**
 * The Team Host row's whole Config, and the one rule that carries a pre-rename
 * row's values forward. Dependency-light: `index.ts` owns the service, this
 * module owns the shape and the precedence judgement.
 * @module @contexera/dsh-agent-team/host-row-settings
 */
import z from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import { type MemberCompactionConfig } from './member-compaction.ts';
import { type WorkerConfig } from './worker-service.ts';
import { type WakeRecycleConfig } from './wake-recycle.ts';
import { type SidebarOrderConfig } from './sidebar-order.ts';
/**
 * The webhook trigger's deployment facts: not the listener's host and port, which the
 * isolated group in `cordis.patch.yml` owns, but where an outside service reaches it.
 */
export interface WebhookConfig {
    /** The public origin hook addresses hang from; empty means no address exists yet. */
    readonly publicOrigin: string;
}
/** The webhook group before a Human has configured anything: no origin, so no address. */
export declare const DEFAULT_WEBHOOK_CONFIG: WebhookConfig;
/**
 * Config of the Team Host row. Every field is volatile: the settings service
 * offers a form only for volatile fields, so a non-volatile field would be
 * invisible and unwritable.
 */
export interface Config {
    name: Volatile<string>;
    avatarRef: Volatile<string | null | undefined>;
    wakeRecycle: Volatile<WakeRecycleConfig>;
    memberCompaction: Volatile<MemberCompactionConfig>;
    worker: Volatile<WorkerConfig>;
    webhook: Volatile<WebhookConfig>;
    sidebarOrder: Volatile<SidebarOrderConfig>;
    extraToolGrants: Volatile<string[]>;
}
/** The wake-swap thresholds as one volatile group, with its own defaults so an unwritten profile still resolves a complete config. */
export declare const WAKE_RECYCLE_SETTINGS_SCHEMA: z<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    idleMs: z<number, number, "defined">;
    minContextTokens: z<number, number, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    idleMs: z<number, number, "defined">;
    minContextTokens: z<number, number, "defined">;
}>>>, "volatile-defined">;
/** The Member input budget as one volatile group. */
export declare const MEMBER_COMPACTION_SETTINGS_SCHEMA: z<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    tokens: z<number, number, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    tokens: z<number, number, "defined">;
}>>>, "volatile-defined">;
/** The experimental Worker delegation group; off until the operator turns it on. */
export declare const WORKER_SETTINGS_SCHEMA: z<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    defaultEngine: z<"codex" | "claude", "codex" | "claude", "defined">;
    engines: z<Schemastery.ObjectS<NoInfer<{
        codex: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
        claude: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        codex: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
        claude: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
    }>>, "defined">;
    timeoutMs: z<number, number, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    defaultEngine: z<"codex" | "claude", "codex" | "claude", "defined">;
    engines: z<Schemastery.ObjectS<NoInfer<{
        codex: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
        claude: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        codex: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
        claude: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            executable: z<string, string, "defined">;
            sandbox: z<string, string, "defined">;
        }>>, "defined">;
    }>>, "defined">;
    timeoutMs: z<number, number, "defined">;
}>>>, "volatile-defined">;
/** The webhook deployment group. */
export declare const WEBHOOK_SETTINGS_SCHEMA: z<NoInfer<Schemastery.ObjectS<NoInfer<{
    publicOrigin: z<string, string, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    publicOrigin: z<string, string, "defined">;
}>>>, "volatile-defined">;
/** Exact extra tool names shared by every Team Member in this profile; empty until the Human opts in. */
export declare const EXTRA_TOOL_GRANTS_SETTINGS_SCHEMA: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
/**
 * The Host row's whole schema: the profile fields verbatim, so {@link HUMAN_PROFILE_SETTINGS_SCHEMA} keeps owning their volatility and defaults.
 * A patch layer replaces the row's whole config, so the parts are declared together.
 */
export declare const TEAM_HOST_ROW_SETTINGS_SCHEMA: z<Schemastery.ObjectS<NoInfer<{
    wakeRecycle: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        idleMs: z<number, number, "defined">;
        minContextTokens: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        idleMs: z<number, number, "defined">;
        minContextTokens: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    memberCompaction: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tokens: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tokens: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    worker: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        defaultEngine: z<"codex" | "claude", "codex" | "claude", "defined">;
        engines: z<Schemastery.ObjectS<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        defaultEngine: z<"codex" | "claude", "codex" | "claude", "defined">;
        engines: z<Schemastery.ObjectS<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    webhook: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        publicOrigin: z<string, string, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        publicOrigin: z<string, string, "defined">;
    }>>>, "volatile-defined">;
    sidebarOrder: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        version: z<number, number, "defined">;
        lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        version: z<number, number, "defined">;
        lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
    }>>>, "volatile-defined">;
    extraToolGrants: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    wakeRecycle: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        idleMs: z<number, number, "defined">;
        minContextTokens: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        idleMs: z<number, number, "defined">;
        minContextTokens: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    memberCompaction: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tokens: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tokens: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    worker: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        defaultEngine: z<"codex" | "claude", "codex" | "claude", "defined">;
        engines: z<Schemastery.ObjectS<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        defaultEngine: z<"codex" | "claude", "codex" | "claude", "defined">;
        engines: z<Schemastery.ObjectS<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            codex: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
            claude: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                executable: z<string, string, "defined">;
                sandbox: z<string, string, "defined">;
            }>>, "defined">;
        }>>, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    webhook: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        publicOrigin: z<string, string, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        publicOrigin: z<string, string, "defined">;
    }>>>, "volatile-defined">;
    sidebarOrder: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        version: z<number, number, "defined">;
        lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        version: z<number, number, "defined">;
        lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
    }>>>, "volatile-defined">;
    extraToolGrants: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
}>>, "plain">;
/** Every field the row stores, in the order a migration writes them. */
export declare const HOST_ROW_FIELDS: readonly ["name", "avatarRef", "wakeRecycle", "memberCompaction", "worker", "webhook", "sidebarOrder", "extraToolGrants"];
export type HostRowField = typeof HOST_ROW_FIELDS[number];
/** The values one migration writes into the current namespace; a field is present only when it must be written. */
export type HostRowWrite = {
    readonly [K in HostRowField]?: K extends 'name' ? string : K extends 'avatarRef' ? string | null : K extends 'wakeRecycle' ? WakeRecycleConfig : K extends 'memberCompaction' ? MemberCompactionConfig : K extends 'worker' ? WorkerConfig : K extends 'webhook' ? WebhookConfig : K extends 'sidebarOrder' ? SidebarOrderConfig : string[];
};
/**
 * Decides what a migration may write into the Host row: the pre-rename values
 * of the fields the current namespace stores nothing for, validated against the
 * same schema the settings service will validate them with.
 *
 * `stored` is that namespace's own USER layer, never a resolved config: it
 * carries exactly the fields the Human wrote, so a field they set — even to a
 * value equal to the schema default — is not a gap and is never overwritten.
 * Both pre-rename sources go through here, so the two migrations cannot
 * disagree about precedence.
 *
 * A field that fails its schema, or a display name that is the shipped default
 * (the row says nothing a fresh row would not), is left behind.
 */
export declare function planHostRowWrite(stored: Readonly<Record<string, unknown>>, carried: Readonly<Record<string, unknown>>): HostRowWrite | undefined;
//# sourceMappingURL=host-row-settings.d.ts.map