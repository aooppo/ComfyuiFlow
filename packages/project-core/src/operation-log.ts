export interface OperationLogEntry {
  operation: string;
  result: string;
  projectId?: string;
  assetId?: string;
  byteSize?: number;
  elapsedMs?: number;
}

export function operationLog(
  entry: OperationLogEntry,
  sink: (line: string) => void = console.info,
) {
  sink(
    JSON.stringify({
      operation: entry.operation,
      result: entry.result,
      ...(entry.projectId ? { projectId: entry.projectId } : {}),
      ...(entry.assetId ? { assetId: entry.assetId } : {}),
      ...(entry.byteSize === undefined ? {} : { byteSize: entry.byteSize }),
      ...(entry.elapsedMs === undefined ? {} : { elapsedMs: entry.elapsedMs }),
    }),
  );
}
