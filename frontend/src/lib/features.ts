/**
 * Feature flags — flip to re-enable without restoring removed code.
 */
export const NOTION_FEATURE_ENABLED = false;

export function isNotionFeatureEnabled(): boolean {
  return NOTION_FEATURE_ENABLED;
}
