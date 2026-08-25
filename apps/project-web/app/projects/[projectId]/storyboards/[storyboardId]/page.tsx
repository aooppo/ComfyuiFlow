import { StoryboardEditor } from "../../../../../components/storyboards/storyboard-editor";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ projectId: string; storyboardId: string }>;
}) {
  const values = await params;
  return <StoryboardEditor projectId={values.projectId} storyboardId={values.storyboardId} />;
}
