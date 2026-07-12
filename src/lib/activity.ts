/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityLog } from '../types';

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log-001',
    userId: 'admin-uuid-001',
    userEmail: 'tkpaite2016@gmail.com',
    userName: 'T.K. Paite',
    action: 'System Bootstrapped',
    details: 'Shalom Youth Member Management Database initialized.',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export function getActivityLogs(): ActivityLog[] {
  const cached = localStorage.getItem('sy_activity_logs');
  if (!cached) {
    localStorage.setItem('sy_activity_logs', JSON.stringify(INITIAL_LOGS));
    return INITIAL_LOGS;
  }
  return JSON.parse(cached);
}

export function addActivityLog(
  userId: string,
  userEmail: string,
  userName: string,
  action: string,
  details: string,
  targetUserId?: string,
  targetUserName?: string
): ActivityLog {
  const logs = getActivityLogs();
  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
    userId,
    userEmail,
    userName,
    action,
    details,
    created_at: new Date().toISOString(),
    targetUserId,
    targetUserName
  };
  logs.unshift(newLog); // push to top
  // limit to last 200 logs
  const slicedLogs = logs.slice(0, 200);
  localStorage.setItem('sy_activity_logs', JSON.stringify(slicedLogs));
  return newLog;
}

export function clearActivityLogs() {
  localStorage.setItem('sy_activity_logs', JSON.stringify([]));
}
