/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LastSeenInfo {
  label: string;
  relativeTime: string;
  fullDate: string;
  isOnline: boolean;
  isRecent: boolean;     // Active within 24 hours
  isInactive: boolean;   // Inactive > 30 days or never logged in
  daysAgo: number | null;
}

export function formatLastSeenInfo(
  lastSeen?: string | null,
  isOnline: boolean = false
): LastSeenInfo {
  if (isOnline) {
    return {
      label: 'Online now',
      relativeTime: 'Online now',
      fullDate: 'Currently active on Shalom Youth',
      isOnline: true,
      isRecent: true,
      isInactive: false,
      daysAgo: 0,
    };
  }

  if (!lastSeen) {
    return {
      label: 'Never logged in',
      relativeTime: 'Never',
      fullDate: 'No recorded activity',
      isOnline: false,
      isRecent: false,
      isInactive: true,
      daysAgo: null,
    };
  }

  const date = new Date(lastSeen);
  if (isNaN(date.getTime())) {
    return {
      label: 'Never logged in',
      relativeTime: 'Never',
      fullDate: 'No recorded activity',
      isOnline: false,
      isRecent: false,
      isInactive: true,
      daysAgo: null,
    };
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const fullDate = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let relativeTime = '';
  if (diffSecs < 60) {
    relativeTime = `${Math.max(1, diffSecs)}s ago`;
  } else if (diffMins < 60) {
    relativeTime = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relativeTime = `${diffHours}h ago`;
  } else if (diffDays < 30) {
    relativeTime = `${diffDays}d ago`;
  } else if (diffDays < 365) {
    const months = Math.max(1, Math.floor(diffDays / 30));
    relativeTime = `${months}mo ago`;
  } else {
    const years = Math.max(1, Math.floor(diffDays / 365));
    relativeTime = `${years}y ago`;
  }

  return {
    label: `Last active ${relativeTime}`,
    relativeTime,
    fullDate,
    isOnline: false,
    isRecent: diffHours < 24,
    isInactive: diffDays >= 30, // Consider >= 30 days inactive
    daysAgo: diffDays,
  };
}
