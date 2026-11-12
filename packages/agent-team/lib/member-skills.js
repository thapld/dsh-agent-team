/**
 * Per-Member private skill provider: wraps the Harness filesystem provider so one Member discovers only the plugin's bundled read-only core skills plus its private `skills/` directory (default roots excluded), filtered by that Member's selection.
 * @module @contexera/dsh-agent-team/member-skills
 */
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem';
/**
 * Registers the Member-private skill provider on one Member's agent scope and returns its disposer; no sibling Member or ordinary session sees the catalog.
 *
 * Registration goes through the traceable service resolved from the agent context (like `tools.restrict()`), never a plugin mount: a mount from Host activation lands on the Host's trace fiber instead of the agent scope, and a plugin `inject` would hold Member activation open. Without a skill registry the Member has no private catalog.
 */
export function mountMemberSkillProvider(agentCtx, config) {
    const skills = agentCtx.get('skills');
    // No registry: return no handle, since a no-op handle would pretend a filter exists.
    if (skills === undefined)
        return undefined;
    let mounted;
    const dispose = skills.registerProvider(control => {
        mounted = new MemberPrivateSkillProvider(agentCtx, control, config);
        return mounted;
    });
    return {
        swap: (allow) => mounted?.select(allow),
        dispose,
    };
}
/** One Member's bundled-plus-private skill roots wrapped as a filtered registry provider. */
class MemberPrivateSkillProvider {
    name;
    wrapped;
    control;
    /** `undefined` loads every discovered skill. */
    allow;
    constructor(ctx, control, config) {
        this.control = control;
        this.allow = config.initialSelection;
        this.name = `member-private:${config.skillsDirectory}`;
        // Bundled read-only core skills first, then the Member's private directory; both share the custom rank and discovery keeps the first root's same-name candidate, so bundled skills stay stable across upgrades.
        const customSkillDirs = config.bundledSkillsDirectory === undefined
            ? [config.skillsDirectory]
            : [config.bundledSkillsDirectory, config.skillsDirectory];
        this.wrapped = new FileSystemSkillProvider(ctx, control, {
            providerName: this.name,
            includeDefaultRoots: false,
            customSkillDirs,
        });
    }
    /** Replace the live filter and drop cached catalogs, so the next query sees it. */
    select(allow) {
        this.allow = allow;
        this.control.invalidate();
    }
    /** Filters the wrapped discovery to the Member's selection. `list()` output only: the directory is still scanned and watched, so this is not a security boundary. */
    async list(options) {
        const output = await this.wrapped.list(options);
        const allow = this.allow;
        if (allow === undefined)
            return output;
        const allowed = new Set(allow);
        return filterObservation(output, candidate => allowed.has(candidate.name));
    }
    async get(candidate, options) {
        return this.wrapped.get(candidate, options);
    }
}
/** Apply one name filter to either provider observation shape. */
function filterObservation(output, keep) {
    if (!('candidates' in output))
        return output.filter(keep);
    return { candidates: output.candidates.filter(keep), complete: output.complete };
}
