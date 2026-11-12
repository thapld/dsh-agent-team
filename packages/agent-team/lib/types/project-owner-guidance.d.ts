/**
 * The Project-owner guidance section.
 *
 * Ownership is a live fact of the ledger, so the Host registers this section
 * once per Member generation and evaluates its text at every assembly: a Member
 * that owns no Project contributes nothing, and a grant or a withdrawal changes
 * the prompt at the next assembly without a restart. The Worker paragraph
 * follows the same Host switch that declares `team_worker`, so the guidance and
 * the tool surface never disagree.
 *
 * The text holds standing duties and judgment only. Tool parameters belong to
 * the tool descriptions, and per-Project facts belong to the ledger, which the
 * Member reads through the Team tools.
 * @module @contexera/dsh-agent-team/project-owner-guidance
 */
/** Section name; the `team:` prefix marks a Team-owned contribution to a Member's prompt. */
export declare const PROJECT_OWNER_SECTION = "team:project-owner";
/** The live facts one assembly needs; both are read again at the next assembly. */
export interface ProjectOwnerFacts {
    /** Whether the Member owns at least one active Project right now. */
    readonly ownsProject: boolean;
    /** Whether the Host Worker switch is on — the same switch that declares `team_worker`. */
    readonly workerEnabled: boolean;
}
/** The section text for one assembly; empty while the Member owns no Project. */
export declare function projectOwnerGuidance(facts: ProjectOwnerFacts): string;
//# sourceMappingURL=project-owner-guidance.d.ts.map