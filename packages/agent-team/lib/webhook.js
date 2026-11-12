/**
 * The public webhook entry, on the listener `webhook-ingress.ts` mounts: it decides what
 * only an entry can (body limit, read deadline, status table) and asks the Host the rest.
 * @module @contexera/dsh-agent-team/webhook
 */
import { WEBHOOK_BODY_MAX_BYTES, WEBHOOK_PATH_PREFIX, WEBHOOK_READ_DEADLINE_MS, WEBHOOK_STATUS, forwardableHeaders, webhookTokenOfPath, } from "./subscription-webhook.js";
/** Cordis plugin name. */
export const name = 'agent-team-webhook';
/** `webServer` is the ingress realm's own listener; `agentTeam` stays the shared Host. */
export const inject = ['agentTeam', 'webServer'];
/** The route prefix without its trailing slash, which is how the router names it. */
const ROUTE_PATH = WEBHOOK_PATH_PREFIX.replace(/\/+$/, '');
export const apply = (ctx) => {
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PATH,
        handler: (req, res) => handleWebhookRequest(ctx, req, res),
    }), 'agent-team.webhook.route');
};
/** One request's whole life. Nothing logs the path: it carries the token. */
async function handleWebhookRequest(ctx, req, res) {
    if (req.method !== 'POST')
        return answer(res, WEBHOOK_STATUS.notPost, { allow: 'POST' });
    const pathname = requestPathname(req);
    const token = pathname === undefined ? undefined : webhookTokenOfPath(pathname);
    if (token === undefined)
        return answer(res, WEBHOOK_STATUS.notFound);
    const encoding = req.headers['content-encoding'];
    if (encoding !== undefined && encoding !== 'identity')
        return answer(res, WEBHOOK_STATUS.unsupportedEncoding);
    const forwarded = forwardableHeaders(req.headers);
    if (!forwarded.ok)
        return answer(res, WEBHOOK_STATUS.headerTooLarge);
    const read = await readBody(req);
    if (read.kind === 'too-large') {
        // Answer first, then drop the rest: a body this entry will not read must not
        // keep the connection open, but the provider still deserves the status.
        return answer(res, WEBHOOK_STATUS.bodyTooLarge, {}, () => req.destroy());
    }
    if (read.kind === 'timed-out' || read.kind === 'broken')
        return;
    let body;
    try {
        body = new TextDecoder('utf-8', { fatal: true }).decode(read.body);
    }
    catch {
        // A signature hashes bytes, and replacement characters would change them:
        // a body this entry cannot carry verbatim is refused instead of mangled.
        return answer(res, WEBHOOK_STATUS.notUtf8);
    }
    let intake;
    try {
        intake = await ctx.agentTeam.intakeWebhookDelivery({ token, headers: forwarded.headers, body });
    }
    catch (error) {
        ctx.logger.warn(`agent-team: a webhook delivery could not be queued: ${error instanceof Error ? error.message : String(error)}`);
        return answer(res, WEBHOOK_STATUS.storageFailed);
    }
    switch (intake.kind) {
        case 'queued':
            return answer(res, WEBHOOK_STATUS.queued);
        case 'not-found':
            return answer(res, WEBHOOK_STATUS.notFound);
        case 'paused':
            return answer(res, WEBHOOK_STATUS.paused);
        case 'queue-full':
            return answer(res, WEBHOOK_STATUS.queueFull, { 'retry-after': String(intake.retryAfterSeconds) });
    }
}
/** The pathname a request names, or `undefined` when it is not one absolute path. */
function requestPathname(req) {
    const target = req.url;
    if (target === undefined || !target.startsWith('/'))
        return undefined;
    try {
        return new URL(target, 'http://webhook.invalid').pathname;
    }
    catch {
        return undefined;
    }
}
/** Read the body under the size limit and the deadline: a partial body verifies nothing. */
function readBody(req) {
    return new Promise(resolve => {
        const chunks = [];
        let received = 0;
        let settled = false;
        const settle = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };
        const timer = setTimeout(() => {
            settle({ kind: 'timed-out' });
            req.destroy();
        }, WEBHOOK_READ_DEADLINE_MS);
        req.on('data', (chunk) => {
            received += chunk.byteLength;
            if (received > WEBHOOK_BODY_MAX_BYTES) {
                // Stop buffering at the limit; the caller answers and closes.
                settle({ kind: 'too-large' });
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => settle({ kind: 'body', body: Buffer.concat(chunks) }));
        req.on('error', () => settle({ kind: 'broken' }));
        req.on('aborted', () => settle({ kind: 'broken' }));
    });
}
/** One complete answer: no chunking, no keep-alive, and no body behind the status. */
function answer(res, status, headers = {}, flushed) {
    if (res.writableEnded || res.destroyed)
        return;
    res.writeHead(status, { ...headers, 'content-length': '0', connection: 'close' });
    res.end(flushed);
}
