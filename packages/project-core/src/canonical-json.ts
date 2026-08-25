import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  return serialize(value, new Set<object>(), "$root");
}

export function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function serialize(value: unknown, ancestors: Set<object>, path: string): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}`);
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`Unsupported canonical JSON value at ${path}`);
  }
  if (ancestors.has(value)) throw new TypeError(`Circular canonical JSON value at ${path}`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value
        .map((item, index) => serialize(item, ancestors, `${path}[${index}]`))
        .join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Canonical JSON requires a plain object at ${path}`);
    }
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serialize(object[key], ancestors, `${path}.${key}`)}`)
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}
