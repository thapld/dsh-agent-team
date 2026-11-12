import type { Agent } from '@deepseek-ai/dsh-agent';
export declare function readingCapacity(agent: Agent, signal: AbortSignal): Promise<number>;
export interface MessagePart {
    readonly messageRef: string;
    readonly start: number;
    readonly end: number;
    readonly complete: boolean;
}
export declare const MESSAGE_PART_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly messageRef: {
            readonly type: "string";
            readonly required: true;
        };
        readonly start: {
            readonly type: "number";
            readonly required: true;
        };
        readonly end: {
            readonly type: "number";
            readonly required: true;
        };
        readonly complete: {
            readonly type: "boolean";
            readonly required: true;
        };
    };
};
interface Entry {
    readonly sequence: number;
    readonly kind: string;
    readonly messageRef?: string | undefined;
    readonly body?: string | undefined;
    readonly bodyOmitted?: boolean | undefined;
    readonly unread?: boolean | undefined;
}
interface Reading {
    readonly projectRef: string;
    readonly threadRef?: string | undefined;
    readonly kind: string;
    readonly facts?: readonly Entry[] | undefined;
    readonly entries?: readonly Entry[] | undefined;
    readonly message?: {
        readonly messageRef: string;
        readonly body: string;
        readonly sequence: number;
        readonly bodyOmitted?: boolean;
    } | undefined;
    readonly remainingUnreadCount?: number | undefined;
    readonly reminders?: readonly unknown[] | undefined;
    readonly messageParts?: readonly MessagePart[] | undefined;
    readonly continuation?: string | undefined;
}
export declare function messagePartText(body: string, part: MessagePart | undefined): string;
/** Select exactly the renderable prefix before the Host acknowledges it. Repeated calls fill the first gap on the live surface. */
export declare function budgetReading<V extends Reading>(agent: Agent, value: V, render: (value: V) => string, capacity: number): {
    value: V;
    through: number;
};
export {};
//# sourceMappingURL=reading-budget.d.ts.map