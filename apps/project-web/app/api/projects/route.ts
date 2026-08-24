import { ProjectService, projectInputSchema, projectStatusSchema } from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../lib/api";

export const runtime = "nodejs";

const service = new ProjectService();

export async function GET(request: Request) {
  try {
    const status = projectStatusSchema.parse(
      new URL(request.url).searchParams.get("status") ?? "ACTIVE",
    );
    return Response.json({ projects: await service.list(status) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = projectInputSchema.parse(await jsonBody(request));
    return Response.json(await service.create(input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
