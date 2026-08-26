import {
  createStoryboardDirectorRunSchema,
  createStoryboardSchema,
  StoryboardDirectorService,
  StoryboardService,
} from "@comfyuiflow/project-core";
import { apiError, jsonBody } from "../../../../../lib/api";

const service = new StoryboardService();
const director = new StoryboardDirectorService();
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const requestedStatus = new URL(request.url).searchParams.get("status");
    const status = requestedStatus === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
    return Response.json({
      storyboards: await service.list((await context.params).projectId, 50, status),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const projectId = (await context.params).projectId;
    const body = await jsonBody(request);
    if (typeof body === "object" && body !== null && "previewHash" in body) {
      const storyboard = await director.createAndConfirm(
        projectId,
        createStoryboardDirectorRunSchema.parse(body),
      );
      return Response.json(storyboard, {
        status: 201,
        headers: { ETag: '"storyboard-1"' },
      });
    }
    const storyboard = await service.create(projectId, createStoryboardSchema.parse(body));
    return Response.json(storyboard, { status: 201, headers: { ETag: '"storyboard-0"' } });
  } catch (error) {
    return apiError(error);
  }
}
