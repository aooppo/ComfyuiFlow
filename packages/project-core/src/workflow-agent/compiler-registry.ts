import type { CompilerProfileV2, VersionRefV2 } from "@comfyuiflow/contracts";
import {
  compileHailuo03FirstLast,
  compileHailuo03Reference,
  compileHailuo03Text,
} from "./compilers/hailuo03.js";

type Compiler = (input: unknown) => ReturnType<typeof compileHailuo03Text>;

export class CapabilityCompilerRegistry {
  private readonly compilers = new Map<string, Compiler>();

  constructor() {
    this.register("hailuo03-text-v1", compileHailuo03Text)
      .register("hailuo03-reference-v1", compileHailuo03Reference)
      .register("hailuo03-first-last-v1", compileHailuo03FirstLast);
  }

  register(key: string, compiler: Compiler) {
    if (this.compilers.has(key)) throw new Error(`COMPILER_ALREADY_REGISTERED: ${key}`);
    this.compilers.set(key, compiler);
    return this;
  }

  compile(profile: CompilerProfileV2, input: unknown) {
    const compiler = this.compilers.get(profile.compilerKey);
    if (!compiler) throw new Error(`COMPILER_NOT_IMPLEMENTED: ${profile.compilerKey}`);
    return compiler(input);
  }

  resolveExact(profile: CompilerProfileV2, reference: VersionRefV2) {
    if (profile.id !== reference.id || profile.version !== reference.version)
      throw new Error("COMPILER_VERSION_MISMATCH");
    if (!this.compilers.has(profile.compilerKey))
      throw new Error(`COMPILER_NOT_IMPLEMENTED: ${profile.compilerKey}`);
    return profile.compilerKey;
  }
}
