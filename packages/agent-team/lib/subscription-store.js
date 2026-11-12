/**
 * The private state a Project subscription keeps outside the ledger: the
 * scheduling checkpoint, the last fifty runs, the failed deliveries waiting for
 * an owner, and the answers already given to a replay request. Deleting every
 * row changes no domain result — the ledger's accepted and published records
 * remain the authority for what happened.
 * @module @contexera/dsh-agent-team/subscription-store
 */
import { z } from 'zod';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { SUBSCRIPTION_ADMISSION_STATES } from "./subscription-admissions.js";
import { SUBSCRIPTION_RUN_CATEGORIES } from "./subscription-runner.js";
import { SUBSCRIPTION_REPLAY_STATES, } from "./subscription-runs.js";
const subscriptionRefSchema = z.string().regex(/^subscription:[^:]+$/).transform(value => value);
const checkpointSchema = z.object({
    subscriptionRef: subscriptionRefSchema,
    dueAt: z.number().int().nonnegative().optional(),
    consecutiveFailures: z.number().int().nonnegative(),
    failureResumeSequence: z.number().int().nonnegative().optional(),
    failureSuccessEpoch: z.number().int().nonnegative().optional(),
    countedAdmissionRef: z.string().regex(/^admission:[^:]+$/).optional(),
    lastSuccessAt: z.string().datetime().optional(),
    publishWindowMinute: z.number().int().nonnegative().optional(),
    publishedInWindow: z.number().int().nonnegative(),
}).strict().transform((value) => Object.freeze(value));
const scriptSchema = z.object({
    content: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    shell: z.union([z.literal('bash'), z.literal('pwsh')]),
}).strict();
const credentialSchema = z.object({
    ref: z.string().min(1),
    env: z.string().min(1),
}).strict();
const runCategorySchema = z.enum(SUBSCRIPTION_RUN_CATEGORIES);
/**
 * One run as it is read back: the summary every member sees and the tails only
 * an owner does. The tails are already capped at 8 KiB each by the recorder.
 */
const runSchema = z.object({
    runRef: z.string().regex(/^run:[^:]+$/),
    subscriptionRef: subscriptionRefSchema,
    projectRef: z.string().regex(/^project:[^:]+$/),
    trigger: z.union([z.literal('interval'), z.literal('webhook'), z.literal('test')]),
    startedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative(),
    category: runCategorySchema,
    reason: z.string().optional(),
    exitCode: z.number().int().nullable(),
    timedOut: z.boolean(),
    eventCount: z.number().int().nonnegative(),
    stdoutTail: z.string(),
    stderrTail: z.string(),
    subscriptionRevision: z.number().int().positive(),
    scriptHash: z.string().regex(/^[0-9a-f]{64}$/),
    deliveryRef: z.string().min(1).optional(),
    attempt: z.number().int().nonnegative(),
}).strict().transform((value) => Object.freeze(value));
const deliverySchema = z.object({
    deliveryRef: z.string().regex(/^delivery:[^:]+$/),
    /** The Host admission this delivery came from: the id a replay hands the script again. */
    admissionRef: z.string().min(1).optional(),
    subscriptionRef: subscriptionRefSchema,
    projectRef: z.string().regex(/^project:[^:]+$/),
    receivedRevision: z.number().int().positive(),
    receivedScriptHash: z.string().regex(/^[0-9a-f]{64}$/),
    script: scriptSchema,
    credentials: z.array(credentialSchema).max(8),
    body: z.string(),
    receivedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    attempts: z.number().int().nonnegative(),
    lastError: z.string(),
    replay: z.object({
        requestId: z.string().min(1),
        runRef: z.string().min(1).optional(),
        succeeded: z.boolean(),
        reason: z.string().optional(),
    }).strict().optional(),
}).strict().transform((value) => Object.freeze(value));
/**
 * One replay request as it is read back: which request asked for which delivery,
 * under which version, whether it is still running, and what it answered. It is
 * dropped with the delivery it names, because an answer about a delivery nobody
 * can see any more is not an answer. A row written before the state existed is a
 * settled answer — the only shape that was ever written.
 */
const replaySchema = z.object({
    subscriptionRef: subscriptionRefSchema,
    projectRef: z.string().regex(/^project:[^:]+$/),
    requestId: z.string().min(1),
    deliveryRef: z.string().regex(/^delivery:[^:]+$/),
    version: z.union([z.literal('current'), z.literal('received')]),
    state: z.enum(SUBSCRIPTION_REPLAY_STATES)
        .optional().transform(value => value ?? 'settled'),
    runRef: z.string().regex(/^run:[^:]+$/).optional(),
    succeeded: z.boolean().optional(),
    eventCount: z.number().int().nonnegative().optional(),
    reason: z.string().optional(),
    expiresAt: z.string().datetime(),
}).strict().transform((value) => Object.freeze(value));
/** One event a delivery kept for later acceptance: shape only, since the run already bounded its lengths. */
const heldEventSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    url: z.string().optional(),
    detail: z.string().optional(),
}).strict();
/**
 * One queued webhook delivery as it is read back. The header map is the narrowed
 * one the entry computed — lowercased, whitelisted, size-checked — so a row can
 * never carry a credential header a later version might learn to forward.
 */
const admissionSchema = z.object({
    admissionRef: z.string().regex(/^admission:[^:]+$/),
    subscriptionRef: subscriptionRefSchema,
    projectRef: z.string().regex(/^project:[^:]+$/),
    deliveryRef: z.string().regex(/^delivery:[^:]+$/),
    receivedRevision: z.number().int().positive(),
    receivedScriptHash: z.string().regex(/^[0-9a-f]{64}$/),
    script: scriptSchema,
    credentials: z.array(credentialSchema).max(8),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
    receivedAt: z.string().datetime(),
    attempts: z.number().int().nonnegative(),
    state: z.enum(SUBSCRIPTION_ADMISSION_STATES),
    nextAttemptAt: z.string().datetime().optional(),
    lastError: z.string().optional(),
    heldEvents: z.array(heldEventSchema).optional(),
    failureStreak: z.object({
        resumeSequence: z.number().int().nonnegative(),
        successEpoch: z.number().int().nonnegative(),
    }).strict().optional(),
}).strict().refine(value => value.state === 'exhausted'
    ? value.lastError !== undefined && value.nextAttemptAt === undefined && value.heldEvents === undefined
    : value.failureStreak === undefined)
    .transform((value) => Object.freeze(value));
export const subscriptionDomainSpec = defineDomain({
    name: 'agent_team_subscriptions',
    // Released v4 readers reject exhausted admissions. Older rows remain valid
    // in a mixed store; they do not need a rewrite before the first v5 write.
    version: 5,
    compatibleVersions: [1, 2, 3, 4],
    tables: {
        checkpoints: domainTable(checkpointSchema),
        runs: domainTable(runSchema),
        deliveries: domainTable(deliverySchema),
        replays: domainTable(replaySchema),
        admissions: domainTable(admissionSchema),
    },
});
