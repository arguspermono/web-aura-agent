const NOTIFICATION_SEEN_STORAGE_KEY = 'aura-notifications-seen-v1';

function getNotificationSeenKey(userId) {
  return `${NOTIFICATION_SEEN_STORAGE_KEY}:${userId}`;
}

export function getNotificationSeenAt(userId) {
  if (!userId) return '';
  return localStorage.getItem(getNotificationSeenKey(userId)) || '';
}

export function markNotificationsSeen(userId) {
  if (!userId) return;
  localStorage.setItem(getNotificationSeenKey(userId), new Date().toISOString());
}

export function getUnreadClaimCount(claims, userId) {
  const seenAt = getNotificationSeenAt(userId);
  const seenTimestamp = seenAt ? new Date(seenAt).getTime() : 0;

  return claims.filter((claim) => {
    const updatedTimestamp = new Date(claim.updated_at || claim.created_at || 0).getTime();
    return updatedTimestamp > seenTimestamp;
  }).length;
}
