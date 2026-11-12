export function planInboxDelivery(input) {
    const immediate = [];
    const delivered = [];
    const threads = [];
    const undelivered = new Set(input.undelivered ?? []);
    for (const { item, facts, reminders = [] } of input.threads) {
        const threadRef = item.thread.threadRef;
        // A reminder is always delivered: it is the whole reason the notice exists
        // when the Thread holds no ordinary unread.
        if (reminders.length > 0) {
            const reminderFacts = [threadRef, 'reminder', ...reminders.map(reminder => `${reminder.kind}:${reminder.baselineSequence}`)];
            immediate.push(reminderFacts);
            delivered.push(reminderFacts);
        }
        const now = facts.map(entry => entry.fact.sequence);
        if (now.length > 0)
            immediate.push([threadRef, ...now]);
        // A Thread the notice cannot render is not delivered by this attempt, so its
        // facts are not what `covered` records: an unchanged rederivation still sees
        // them as owed and re-attempts instead of standing down.
        if (now.length > 0 && !undelivered.has(threadRef))
            delivered.push([threadRef, ...now]);
        threads.push(Object.freeze({ threadRef, role: item.attention === undefined ? 'member' : 'follower' }));
    }
    for (const reminder of input.reminders ?? []) {
        immediate.push(['member-reminder', reminder.reminderRef, reminder.sequence]);
    }
    for (const reminder of input.deliveredReminders ?? input.reminders ?? []) {
        delivered.push(['member-reminder', reminder.reminderRef, reminder.sequence]);
    }
    for (const { projectRef, entries } of input.main) {
        if (entries.length > 0) {
            immediate.push([projectRef, ...entries.map(entry => entry.sequence)]);
            delivered.push([projectRef, ...entries.map(entry => entry.sequence)]);
        }
    }
    const signature = immediate.length === 0 ? '' : JSON.stringify(immediate);
    const covered = delivered.length === 0 ? '' : JSON.stringify(delivered);
    const trigger = signature !== '' && covered !== input.covered ? 'immediate' : undefined;
    return Object.freeze({ trigger, signature, delivered: covered, threads: Object.freeze(threads) });
}
