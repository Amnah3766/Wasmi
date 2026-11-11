import type { Metadata } from 'next';
import { FinderView } from '@/components/views/FinderView';

export const metadata: Metadata = { title: 'اكتشف ريحتك' };

export default function FinderPage() {
  return <FinderView />;
}
