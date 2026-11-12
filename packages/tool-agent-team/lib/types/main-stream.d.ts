import type { AgentTeamMainStreamStanding, AgentTeamMainTimelineEntry } from '@contexera/dsh-agent-team/types';
/** Model-facing view of one Main stream entry: the Host's timeline entry with identities as plain strings. */
export interface MainEntryView {
    readonly sequence: number;
    readonly kind: string;
    readonly occurredAt: string;
    readonly unread: boolean;
    readonly direct: boolean;
    readonly sender?: string;
    readonly messageRef?: string;
    readonly body?: string;
    readonly bodyOmitted?: boolean;
    readonly mentions?: string[];
    readonly replyToMessageRef?: string;
    readonly replyTo?: {
        readonly sender: string;
        readonly excerpt: string;
    };
    readonly activity?: string;
    readonly activityRef?: string;
    readonly projectRef?: string;
    readonly activityOmitted?: boolean;
    readonly actor?: string;
    readonly memberId?: string;
    readonly threadRef?: string;
    readonly preview?: string;
    readonly taskRef?: string;
    readonly taskNumber?: number;
    readonly status?: string;
    readonly resolution?: string;
    readonly accountable?: string;
    readonly replyCount?: number;
    readonly participants?: string[];
    readonly liveClaimOwners?: string[];
    /** A published subscription event: its record is untrusted external text, and it names no sender. */
    readonly subscriptionRef?: string;
    readonly subscriptionName?: string;
    /** Why a subscription was paused: manual, or the Host after repeated failures. */
    readonly reason?: string;
    readonly eventId?: string;
    readonly title?: string;
    readonly url?: string;
    readonly detail?: string;
}
export declare const MAIN_ENTRY_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly sequence: {
            readonly type: "number";
            readonly required: true;
        };
        readonly kind: {
            readonly type: "string";
            readonly required: true;
        };
        readonly occurredAt: {
            readonly type: "string";
            readonly required: true;
        };
        readonly unread: {
            readonly type: "boolean";
            readonly required: true;
        };
        readonly direct: {
            readonly type: "boolean";
            readonly required: true;
        };
        readonly sender: {
            readonly type: "string";
        };
        readonly messageRef: {
            readonly type: "string";
        };
        readonly body: {
            readonly type: "string";
        };
        readonly bodyOmitted: {
            readonly type: "boolean";
        };
        readonly mentions: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly replyToMessageRef: {
            readonly type: "string";
        };
        readonly replyTo: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly sender: {
                    readonly type: "string";
                    readonly required: true;
                };
                readonly excerpt: {
                    readonly type: "string";
                    readonly required: true;
                };
            };
        };
        readonly activity: {
            readonly type: "string";
        };
        readonly activityRef: {
            readonly type: "string";
        };
        readonly projectRef: {
            readonly type: "string";
        };
        readonly activityOmitted: {
            readonly type: "boolean";
        };
        readonly actor: {
            readonly type: "string";
        };
        readonly memberId: {
            readonly type: "string";
        };
        readonly threadRef: {
            readonly type: "string";
        };
        readonly preview: {
            readonly type: "string";
        };
        readonly taskRef: {
            readonly type: "string";
        };
        readonly taskNumber: {
            readonly type: "number";
        };
        readonly status: {
            readonly type: "string";
        };
        readonly resolution: {
            readonly type: "string";
        };
        readonly accountable: {
            readonly type: "string";
        };
        readonly replyCount: {
            readonly type: "number";
        };
        readonly participants: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly liveClaimOwners: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly subscriptionRef: {
            readonly type: "string";
        };
        readonly subscriptionName: {
            readonly type: "string";
        };
        readonly reason: {
            readonly type: "string";
        };
        readonly eventId: {
            readonly type: "string";
        };
        readonly title: {
            readonly type: "string";
        };
        readonly url: {
            readonly type: "string";
        };
        readonly detail: {
            readonly type: "string";
        };
    };
};
export declare const MAIN_STANDING_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly following: {
            readonly type: "boolean";
            readonly required: true;
        };
        readonly head: {
            readonly type: "number";
            readonly required: true;
        };
        readonly unreadCount: {
            readonly type: "number";
            readonly required: true;
        };
        readonly directCount: {
            readonly type: "number";
            readonly required: true;
        };
    };
};
export declare function mainEntryView(entry: AgentTeamMainTimelineEntry): MainEntryView;
export declare function standingView(standing: AgentTeamMainStreamStanding): {
    following: boolean;
    head: number;
    unreadCount: number;
    directCount: number;
};
/** One rendered Main stream line; a Thread card names the Thread to read and its current state, never a transition. */
export declare function mainEntryLine(entry: MainEntryView): string;
//# sourceMappingURL=main-stream.d.ts.map