import type { ReactNode } from 'react';

// Re-mounted on every navigation, so the original page entrance animation (#view>* fadein) plays per route.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="view-page">{children}</div>;
}
