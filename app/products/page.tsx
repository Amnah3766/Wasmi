import type { Metadata } from 'next';
import { ShopView } from '@/components/views/ShopView';

export const metadata: Metadata = { title: 'المتجر' };

export default function ProductsPage() {
  return <ShopView />;
}
