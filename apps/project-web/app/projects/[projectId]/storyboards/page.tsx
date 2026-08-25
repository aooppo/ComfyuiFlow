import { StoryboardLibrary } from "../../../../components/storyboards/storyboard-library";

export default async function StoryboardsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return <StoryboardLibrary projectId={(await params).projectId} />;
}
