import type { Metadata } from 'next';
import { BrandView } from '@/components/views/StaticViews';

export const metadata: Metadata = { title: 'الهوية' };

export default function BrandPage() {
  return <BrandView />;
}
