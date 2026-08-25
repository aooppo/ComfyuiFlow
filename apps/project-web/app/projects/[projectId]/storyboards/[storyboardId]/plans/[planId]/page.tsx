import { ShotPlanEditor } from "../../../../../../../components/storyboards/shot-plan-editor";

export default async function ShotPlanPage({
  params,
}: {
  params: Promise<{ projectId: string; storyboardId: string; planId: string }>;
}) {
  const values = await params;
  return <ShotPlanEditor {...values} />;
}
