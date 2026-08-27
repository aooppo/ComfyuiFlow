import { MainlineWorkspace } from "../../../components/mainline-workspace";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <MainlineWorkspace projectId={(await params).projectId} />;
}
