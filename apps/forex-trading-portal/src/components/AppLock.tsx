import { ReactNode } from 'react';

/**
 * Android startup safety bypass.
 *
 * The optional native secure-storage / biometric bridge has repeatedly
 * prevented the WebView from leaving its startup screen on affected devices.
 * Do not gate application rendering on that bridge. Authentication for the
 * BIGBULLS account remains handled by the portal's normal auth flow.
 *
 * Device app-lock is intentionally disabled until its native bridge can be
 * validated on physical Android devices.
 */
export default function AppLock({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
