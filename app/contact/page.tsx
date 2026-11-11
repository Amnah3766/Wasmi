import type { Metadata } from 'next';
import { ContactView } from '@/components/views/StaticViews';

export const metadata: Metadata = { title: 'تواصل' };

export default function ContactPage() {
  return <ContactView />;
}
