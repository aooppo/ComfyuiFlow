import { ContinuityWizard } from "../../../../../../components/storyboards/continuity-wizard";

export default async function ContinuityPage({
  params,
}: {
  params: Promise<{ projectId: string; storyboardId: string }>;
}) {
  return <ContinuityWizard {...await params} />;
}
