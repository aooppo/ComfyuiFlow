import type { Project } from "./generated/client/index.js";
import type { ProjectInput, ProjectPatch } from "./contracts.js";
import { ProjectAssetError } from "./contracts.js";
import { prisma, type ProjectPrisma } from "./prisma.js";

export function projectDto(project: Project) {
  return {
    id: project.id,
    name: project.name,
    brief: project.brief,
    targetAspectRatio: project.targetAspectRatio,
    status: project.status,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export class ProjectService {
  constructor(private readonly client: ProjectPrisma = prisma) {}

  async list(status: "ACTIVE" | "ARCHIVED" = "ACTIVE") {
    const projects = await this.client.project.findMany({
      where: { status },
      orderBy: { updatedAt: "desc" },
    });
    return projects.map(projectDto);
  }

  async get(id: string) {
    const project = await this.client.project.findUnique({ where: { id } });
    if (!project) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    return projectDto(project);
  }

  async create(input: ProjectInput) {
    const project = await this.client.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: input.name,
          brief: input.brief ?? null,
          targetAspectRatio: input.targetAspectRatio,
        },
      });
      await tx.projectActivity.create({
        data: { projectId: created.id, type: "PROJECT_CREATED", summary: "Project created" },
      });
      return created;
    });
    return projectDto(project);
  }

  async update(id: string, input: ProjectPatch) {
    const existing = await this.client.project.findUnique({ where: { id } });
    if (!existing) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    if (existing.status !== "ACTIVE") {
      throw new ProjectAssetError(
        "PROJECT_ARCHIVED",
        "Restore this project before editing it",
        409,
      );
    }
    const updated = await this.client.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.brief === undefined ? {} : { brief: input.brief }),
          ...(input.targetAspectRatio === undefined
            ? {}
            : { targetAspectRatio: input.targetAspectRatio }),
        },
      });
      await tx.projectActivity.create({
        data: { projectId: id, type: "PROJECT_UPDATED", summary: "Project details updated" },
      });
      return project;
    });
    return projectDto(updated);
  }

  async archive(id: string) {
    return this.changeStatus(id, "ARCHIVED");
  }

  async restore(id: string) {
    return this.changeStatus(id, "ACTIVE");
  }

  private async changeStatus(id: string, status: "ACTIVE" | "ARCHIVED") {
    const existing = await this.client.project.findUnique({ where: { id } });
    if (!existing) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    if (existing.status === status) return projectDto(existing);
    const updated = await this.client.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: { status, archivedAt: status === "ARCHIVED" ? new Date() : null },
      });
      await tx.projectActivity.create({
        data: {
          projectId: id,
          type: status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_RESTORED",
          summary: status === "ARCHIVED" ? "Project archived" : "Project restored",
        },
      });
      return project;
    });
    return projectDto(updated);
  }
}
