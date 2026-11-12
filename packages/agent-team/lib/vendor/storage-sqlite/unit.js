/**
 * Vendored fork of `@deepseek-ai/dsh-storage-sqlite` (`unit.ts`).
 *
 * Source: deepseek-ai/deepseek-harness
 * `packages/storage/storage-sqlite/src/unit.ts` at version 0.2.2-rc.1
 * (MIT per that version's package metadata and the repo root LICENSE).
 * Kept identical except the `@module` tag below — see `index.ts` for why
 * this backend is vendored and how to sync it.
 */
import { StorageError } from '@deepseek-ai/dsh-storage';
import { recordTableName } from "./schema.js";
/**
 * The SQLite {@link KvUnit}. Constructed by the backend AFTER the unit's
 * record tables exist; statements are prepared once here and reused for every
 * primitive. Values are stored as JSON text in the `value` column.
 */
export class SqliteKvUnit {
    db;
    descriptor;
    onClose;
    ensureBackendUsable;
    onRollbackFailure;
    tables = new Map();
    globalUpsert;
    globalSelect;
    needsVersionStamp;
    closed = false;
    /**
     * @param db - Open database handle owned by the backend (never closed here).
     * @param descriptor - Validated descriptor whose record tables already exist.
     * @param storedVersion - Accepted unit version currently saved on the medium.
     * @param onClose - Backend callback releasing this unit's open-name slot.
     * @param ensureBackendUsable - Rejects use of a connection whose rollback failed.
     * @param onRollbackFailure - Retains the failure on the backend before this call rejects.
     */
    constructor(db, descriptor, storedVersion, onClose, ensureBackendUsable, onRollbackFailure) {
        this.db = db;
        this.descriptor = descriptor;
        this.onClose = onClose;
        this.ensureBackendUsable = ensureBackendUsable;
        this.onRollbackFailure = onRollbackFailure;
        this.needsVersionStamp = storedVersion !== descriptor.version;
        for (const table of descriptor.tables) {
            // Both name segments are validated against UNIT_NAME_RE by the backend,
            // so the physical identifier is safe to interpolate into statement text.
            const physical = recordTableName(descriptor.name, table);
            this.tables.set(table, {
                upsert: db.prepare(`INSERT INTO "${physical}" (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
                remove: db.prepare(`DELETE FROM "${physical}" WHERE key = ?`),
                selectAll: db.prepare(`SELECT key, value FROM "${physical}"`),
            });
        }
        this.globalUpsert = descriptor.hasGlobal
            ? db.prepare('INSERT INTO unit_globals (unit, value) VALUES (?, ?) ON CONFLICT(unit) DO UPDATE SET value = excluded.value')
            : undefined;
        this.globalSelect = descriptor.hasGlobal
            ? db.prepare('SELECT value FROM unit_globals WHERE unit = ?')
            : undefined;
    }
    loadAll() {
        return this.settle(() => {
            const tables = {};
            for (const [name, statements] of this.tables) {
                // Null prototype: record keys are arbitrary strings, so '__proto__'
                // must land as an own property instead of mutating the prototype.
                const records = Object.create(null);
                for (const row of statements.selectAll.all()) {
                    records[row.key] = this.parseValue(row.value, `table '${name}' key '${row.key}'`);
                }
                tables[name] = records;
            }
            let global = null;
            if (this.globalSelect !== undefined) {
                const row = this.globalSelect.get(this.descriptor.name);
                if (row !== undefined)
                    global = this.parseValue(row.value, 'global slot');
            }
            return { tables, global };
        });
    }
    /** Parse one stored value column, mapping bad JSON to `malformed-medium`. */
    parseValue(text, slot) {
        try {
            return JSON.parse(text);
        }
        catch (error) {
            throw new StorageError('malformed-medium', `kv unit '${this.descriptor.name}' holds unparsable JSON at ${slot}`, { cause: error });
        }
    }
    putRecord(table, key, value) {
        return this.settle(() => {
            const statement = this.statementsFor(table).upsert;
            const text = JSON.stringify(value);
            this.write(() => statement.run(key, text).changes);
        });
    }
    deleteRecord(table, key) {
        return this.settle(() => {
            const statement = this.statementsFor(table).remove;
            this.write(() => statement.run(key).changes);
        });
    }
    deleteRecords(table, keys) {
        return this.settle(() => {
            const remove = this.statementsFor(table).remove;
            if (keys.length === 0)
                return;
            this.write(() => {
                let changes = 0;
                for (const key of new Set(keys))
                    changes += Number(remove.run(key).changes);
                return changes;
            }, true);
        });
    }
    setGlobal(value) {
        return this.settle(() => {
            if (this.globalUpsert === undefined) {
                throw new Error(`kv unit '${this.descriptor.name}' declared no global slot`);
            }
            const statement = this.globalUpsert;
            const text = JSON.stringify(value);
            this.write(() => statement.run(this.descriptor.name, text).changes);
        });
    }
    /** Commit batches and version updates atomically; missing-key deletes leave the stamp unchanged. */
    write(operation, transactional = false) {
        if (!this.needsVersionStamp && !transactional) {
            operation();
            return;
        }
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const changed = operation() > 0;
            if (this.needsVersionStamp && changed) {
                this.db.prepare('UPDATE units SET version = ? WHERE name = ?').run(this.descriptor.version, this.descriptor.name);
            }
            this.db.exec('COMMIT');
            if (changed)
                this.needsVersionStamp = false;
        }
        catch (error) {
            if (this.db.isTransaction) {
                try {
                    this.db.exec('ROLLBACK');
                }
                catch (rollbackError) {
                    const failure = new StorageError('unknown-state', `kv unit '${this.descriptor.name}' write and rollback failed; the backend is unusable and must be closed and reopened`, { cause: new AggregateError([error, rollbackError], 'write and rollback failed', { cause: error }) });
                    this.onRollbackFailure(failure);
                    throw failure;
                }
            }
            throw error;
        }
    }
    close() {
        if (!this.closed) {
            this.closed = true;
            this.onClose();
        }
        return Promise.resolve();
    }
    /**
     * Run one synchronous primitive behind the closed guard, mapping a throw to
     * a rejection so the Promise-returning contract never throws synchronously.
     */
    settle(operation) {
        try {
            this.ensureOpen();
            return Promise.resolve(operation());
        }
        catch (error) {
            // Non-Error throws can only enter through JSON.stringify propagating a
            // value's own toJSON throw; wrap those, preserve every real Error.
            return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
    }
    ensureOpen() {
        if (this.closed) {
            throw new StorageError('closed', `kv unit '${this.descriptor.name}' is closed`);
        }
        this.ensureBackendUsable();
    }
    statementsFor(table) {
        const statements = this.tables.get(table);
        if (statements === undefined) {
            throw new Error(`kv unit '${this.descriptor.name}' declared no table '${table}'`);
        }
        return statements;
    }
}
