/**
 * Vendored fork of `@deepseek-ai/dsh-storage-sqlite` (`unit.ts`).
 *
 * Source: deepseek-ai/deepseek-harness
 * `packages/storage/storage-sqlite/src/unit.ts` at version 0.2.2-rc.1
 * (MIT per that version's package metadata and the repo root LICENSE).
 * Kept identical except the `@module` tag below — see `index.ts` for why
 * this backend is vendored and how to sync it.
 */
/**
 * One opened SQLite KV unit: prepared per-table statements over the
 * `u_<unit>_<table>` record tables plus this unit's row in the shared
 * `unit_globals` table. The first mutation of an accepted older version commits
 * its data and current version stamp in one transaction. Batch deletes also
 * use one transaction; other writes remain single statements. Write ordering
 * belongs to the caller per the KV contract.
 * @module @contexera/dsh-agent-team/sqlite-backend/unit
 */
import type { DatabaseSync } from 'node:sqlite';
import { StorageError } from '@deepseek-ai/dsh-storage';
import type { KvUnit, KvUnitDescriptor } from '@deepseek-ai/dsh-storage';
/**
 * The SQLite {@link KvUnit}. Constructed by the backend AFTER the unit's
 * record tables exist; statements are prepared once here and reused for every
 * primitive. Values are stored as JSON text in the `value` column.
 */
export declare class SqliteKvUnit implements KvUnit {
    private readonly db;
    private readonly descriptor;
    private readonly onClose;
    private readonly ensureBackendUsable;
    private readonly onRollbackFailure;
    private readonly tables;
    private readonly globalUpsert;
    private readonly globalSelect;
    private needsVersionStamp;
    private closed;
    /**
     * @param db - Open database handle owned by the backend (never closed here).
     * @param descriptor - Validated descriptor whose record tables already exist.
     * @param storedVersion - Accepted unit version currently saved on the medium.
     * @param onClose - Backend callback releasing this unit's open-name slot.
     * @param ensureBackendUsable - Rejects use of a connection whose rollback failed.
     * @param onRollbackFailure - Retains the failure on the backend before this call rejects.
     */
    constructor(db: DatabaseSync, descriptor: KvUnitDescriptor, storedVersion: number, onClose: () => void, ensureBackendUsable: () => void, onRollbackFailure: (error: StorageError) => void);
    loadAll(): Promise<{
        tables: Record<string, Record<string, unknown>>;
        global: unknown;
    }>;
    /** Parse one stored value column, mapping bad JSON to `malformed-medium`. */
    private parseValue;
    putRecord(table: string, key: string, value: unknown): Promise<void>;
    deleteRecord(table: string, key: string): Promise<void>;
    deleteRecords(table: string, keys: readonly string[]): Promise<void>;
    setGlobal(value: unknown): Promise<void>;
    /** Commit batches and version updates atomically; missing-key deletes leave the stamp unchanged. */
    private write;
    close(): Promise<void>;
    /**
     * Run one synchronous primitive behind the closed guard, mapping a throw to
     * a rejection so the Promise-returning contract never throws synchronously.
     */
    private settle;
    private ensureOpen;
    private statementsFor;
}
//# sourceMappingURL=unit.d.ts.map