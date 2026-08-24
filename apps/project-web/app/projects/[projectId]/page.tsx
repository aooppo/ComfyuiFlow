import { ProjectWorkspace } from "../../../components/project-workspace";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <ProjectWorkspace projectId={(await params).projectId} />;
}
