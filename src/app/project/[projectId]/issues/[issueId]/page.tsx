import { IssueDetail } from "./_components/issue-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}) {
  const { projectId, issueId } = await params;

  return <IssueDetail projectId={projectId} issueId={issueId} />;
}
