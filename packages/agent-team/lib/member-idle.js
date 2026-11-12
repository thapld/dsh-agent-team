/** Process-local presence observations; intentionally empty after a Host restart. */
export class MemberIdleTracker {
    idleSince = new Map();
    status(memberId, status, nowMs) {
        if (status === 'idle') {
            if (!this.idleSince.has(memberId))
                this.idleSince.set(memberId, nowMs);
        }
        else {
            this.idleSince.delete(memberId);
        }
    }
    idleMs(memberId, nowMs) {
        const since = this.idleSince.get(memberId);
        return since === undefined ? undefined : Math.max(0, nowMs - since);
    }
    forget(memberId) {
        this.idleSince.delete(memberId);
    }
}
