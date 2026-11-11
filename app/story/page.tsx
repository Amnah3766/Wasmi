import type { Metadata } from 'next';
import { StoryView } from '@/components/views/StaticViews';

export const metadata: Metadata = { title: 'قصتنا' };

export default function StoryPage() {
  return <StoryView />;
}
