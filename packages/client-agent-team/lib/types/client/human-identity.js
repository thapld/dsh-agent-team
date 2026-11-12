import { useSyncExternalStore } from 'react';
const INITIAL = { status: 'loading' };
export class TeamHumanIdentity {
    snapshot = INITIAL;
    listeners = new Set();
    reading;
    generation = 0;
    loader;
    constructor(loader) {
        this.loader = loader;
    }
    getSnapshot = () => this.snapshot;
    subscribe = (listener) => {
        this.listeners.add(listener);
        if (this.snapshot.status === 'loading' && this.reading === undefined)
            void this.refresh();
        return () => { this.listeners.delete(listener); };
    };
    /** Concurrent callers share one round trip; a failed refresh keeps the last accepted value beside the error. */
    refresh() {
        return this.startRead(false);
    }
    async refreshAfterWrite() {
        this.generation += 1;
        await this.startRead(true);
    }
    startRead(force) {
        if (!force && this.reading !== undefined)
            return this.reading;
        const generation = this.generation;
        const reading = this.read(generation).finally(() => {
            if (this.reading === reading)
                this.reading = undefined;
        });
        this.reading = reading;
        return reading;
    }
    dispose() {
        this.listeners.clear();
    }
    async read(generation) {
        let profile;
        try {
            const result = await this.loader.loadProfile();
            if (!result.ok) {
                this.recordReadFailure(generation, result.error.message);
                return;
            }
            profile = result.value;
        }
        catch (error) {
            // A dropped connection surfaces as a thrown carrier error, not a result:
            // both are read failures and both keep whatever value already stands.
            this.recordReadFailure(generation, error instanceof Error ? error.message : String(error));
            return;
        }
        let avatarUrl;
        try {
            avatarUrl = await this.avatarUrlFor(profile.avatarRef);
        }
        catch {
            // The name and version facts already succeeded. A broken avatar transport
            // must not hold the whole identity at loading or prevent a later retry.
            avatarUrl = undefined;
        }
        if (generation !== this.generation)
            return;
        this.commit({
            status: 'ready',
            name: profile.name,
            ...(profile.avatarRef === undefined ? {} : { avatarRef: profile.avatarRef }),
            ...(avatarUrl === undefined ? {} : { avatarUrl }),
            ...(profile.settingsFence === undefined ? {} : { settingsFence: profile.settingsFence }),
            version: profile.version,
            repoUrl: profile.repoUrl,
            ...(profile.latestVersion === undefined ? {} : { latestVersion: profile.latestVersion }),
        });
    }
    /** Bytes are immutable per reference, so one fetch serves every later refresh with the same avatar. */
    async avatarUrlFor(avatarRef) {
        if (avatarRef === undefined)
            return undefined;
        if (avatarRef === this.snapshot.avatarRef && this.snapshot.avatarUrl !== undefined)
            return this.snapshot.avatarUrl;
        return (await this.loader.loadAvatarUrl(avatarRef)) ?? undefined;
    }
    /** A previously accepted value stays on screen; only an identity that never loaded becomes `unavailable`. */
    recordReadFailure(generation, message) {
        if (generation !== this.generation)
            return;
        const held = this.snapshot;
        this.commit(held.name === undefined
            ? { ...held, status: 'unavailable', error: message }
            : { ...held, status: 'ready', error: message });
    }
    commit(snapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners)
            listener();
    }
}
/** Settings-page writes share one rule: a successful durable write is never reported as a save failure. */
export class TeamHumanProfileWriter {
    identity;
    loader;
    constructor(identity, loader) {
        this.identity = identity;
        this.loader = loader;
    }
    async setName(name, expectedFence) {
        return this.finish(() => this.loader.setHumanName(name, expectedFence));
    }
    async replaceAvatar(request, expectedFence) {
        return this.finish(() => this.loader.replaceAvatar(request, expectedFence));
    }
    async removeAvatar(expectedFence) {
        return this.finish(() => this.loader.removeAvatar(expectedFence));
    }
    async finish(write) {
        let result;
        try {
            result = await write();
        }
        catch (error) {
            await this.identity.refreshAfterWrite();
            return { kind: 'uncertain', message: errorMessage(error) };
        }
        if (!result.ok) {
            const code = result.error.code;
            if (code === 'settings/conflict') {
                await this.identity.refreshAfterWrite();
                return { kind: 'conflict', message: result.error.message };
            }
            if (code === 'team/human-profile-write-uncertain' || code === 'gateway/internal' || code === 'gateway/cancelled') {
                await this.identity.refreshAfterWrite();
                return { kind: 'uncertain', message: result.error.message };
            }
            return { kind: 'rejected', message: result.error.message };
        }
        await this.identity.refreshAfterWrite();
        const warning = this.identity.getSnapshot().error;
        return warning === undefined ? undefined : { kind: 'saved', warning };
    }
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function useHumanIdentity(identity) {
    return useSyncExternalStore(identity.subscribe, identity.getSnapshot, identity.getSnapshot);
}
