export function getNextHydratedDraft(params: {
  currentDraft: string;
  lastHydratedDraft: string;
  nextSourceDraft: string;
  sourceKeyChanged: boolean;
}) {
  if (params.sourceKeyChanged) {
    return params.nextSourceDraft;
  }

  if (params.currentDraft === params.lastHydratedDraft) {
    return params.nextSourceDraft;
  }

  return params.currentDraft;
}
