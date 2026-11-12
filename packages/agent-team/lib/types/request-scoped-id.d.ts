/** A uuid-shaped id derived from one request in one namespace. The request id is hashed, never embedded, so caller text never reaches a directory name, log path, or UI row. */
export declare function stableRequestUuid(namespace: string, requestId: string, scope?: string): string;
//# sourceMappingURL=request-scoped-id.d.ts.map