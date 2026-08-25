import { randomUUID } from "node:crypto";
import { LocalContentStorage, prisma } from "@comfyuiflow/project-core";

const storage = new LocalContentStorage();
const project = await prisma.project.create({
  data: { name: "AI 导演浏览器验收", targetAspectRatio: "PORTRAIT_9_16" },
});
const preserved = await storage.preserve(
  (async function* () {
    yield Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
  })(),
);
const stored = await prisma.storedObject.upsert({
  where: { sha256: preserved.sha256 },
  update: { verificationStatus: "VERIFIED", verifiedAt: new Date() },
  create: {
    sha256: preserved.sha256,
    byteSize: preserved.byteSize,
    detectedMimeType: preserved.detectedMimeType,
    storageKey: preserved.storageKey,
    verificationStatus: "VERIFIED",
    verifiedAt: new Date(),
  },
});
const file = await prisma.asset.create({
  data: {
    projectId: project.id,
    storedObjectId: stored.id,
    originalFilename: "scene.png",
    displayName: "审批场景参考",
    mediaType: "IMAGE",
    role: "SCENE",
    status: "READY",
  },
});
const semantic = await prisma.productionAsset.create({
  data: { projectId: project.id, type: "SCENE", name: "审批场景", normalizedName: "审批场景" },
});
const semanticVersion = await prisma.productionAssetVersion.create({
  data: {
    projectId: project.id,
    productionAssetId: semantic.id,
    versionNumber: 1,
    status: "ACTIVE",
    displayName: "审批场景",
    factsJson: { location: "明亮摄影棚" },
    publishedAt: new Date(),
  },
});
await prisma.productionAsset.update({
  where: { id: semantic.id },
  data: { currentVersionId: semanticVersion.id },
});
await prisma.assetVersionFile.create({
  data: {
    projectId: project.id,
    productionAssetVersionId: semanticVersion.id,
    projectAssetId: file.id,
    referenceUsage: "SCENE_STYLE",
    approvalStatus: "ACCEPTED",
    status: "ACTIVE",
    isPreferred: true,
  },
});
const storyboard = await prisma.storyboard.create({
  data: {
    projectId: project.id,
    title: "Terra 新方案提案",
    creativeBrief: "用连续竖屏镜头呈现人物与产品的自然互动",
  },
});
const versionId = randomUUID();
await prisma.storyboardVersion.create({
  data: {
    id: versionId,
    projectId: project.id,
    storyboardId: storyboard.id,
    versionNumber: 1,
    source: "OWNER",
    creativeBrief: storyboard.creativeBrief,
    contractVersion: "storyboard-version-v1",
    contentHash: "b".repeat(64),
    shots: {
      create: [
        {
          projectId: project.id,
          shotKey: randomUUID(),
          ordinal: 1,
          title: "当前已审批镜头",
          creativeDescription: "当前方案用于比较",
          startState: "人物站定",
          action: "展示产品",
          endState: "形成定格",
          camera: "稳定中景",
          composition: "主体居中",
          continuityRequirements: [],
          durationSeconds: 2,
        },
      ],
    },
  },
});
await prisma.storyboard.update({
  where: { id: storyboard.id },
  data: { headVersionId: versionId, approvedVersionId: versionId, rowVersion: 1 },
});
process.stdout.write(
  JSON.stringify({
    projectId: project.id,
    storyboardId: storyboard.id,
    url: `/projects/${project.id}/storyboards/${storyboard.id}`,
  }),
);
await prisma.$disconnect();
