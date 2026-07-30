export function cleanTitle(str?: string): string {
  if (!str) return '';
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const BRAND_DEFAULT = 'Shalom Youth';

export const TAB_PAGE_TITLES: Record<string, string> = {
  'directory': 'Members Directory',
  'financials': 'Financial Records',
  'schedule': 'Weekly Service Schedules',
  'birthday-tasks': 'Birthday Celebrations & Tasks',
  'meta-settings': 'Meta & SEO Settings',
  'football': 'Youth Football & Tournaments',
  'prayer-requests': 'Prayer Requests & Fellowship',
  'calling': 'Members Calling Registry',
  'admin-control': 'Admin Control Panel',
};

export function setDynamicPageTitle(pageTitle?: string | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sy_page_title_change', {
      detail: { title: pageTitle ? cleanTitle(pageTitle) : null }
    }));
  }
}
