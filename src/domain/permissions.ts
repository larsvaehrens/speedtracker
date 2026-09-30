export function canViewMatch(creatorId: string, participant: boolean, viewerId: string): boolean {
  return creatorId === viewerId || participant;
}

export function canEditMatch(creatorId: string, viewerId: string): boolean {
  return creatorId === viewerId;
}
