import type { Metadata } from 'next';
import { GiftView } from '@/components/views/GiftView';

export const metadata: Metadata = { title: 'صندوق المواسم' };

export default function GiftPage() {
  return <GiftView />;
}
