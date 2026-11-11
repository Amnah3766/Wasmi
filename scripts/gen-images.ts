// Renders one product image per seed product (Product.image = /images/products/<slug>.svg) from the same React
// illustration the storefront uses (components/ProductArt.tsx), so the stored image matches the on-page art.
//   npm run images   → public/images/products/<slug>.svg (12 files)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductArt } from '../components/ProductArt';
import { PRODUCTS } from './seed/products-data';

const OUT = 'public/images/products';
const XMLNS = 'http://www.w3.org/2000/svg';

mkdirSync(OUT, { recursive: true });
for (const p of PRODUCTS) {
  let svg = renderToStaticMarkup(createElement(ProductArt, { p: { slug: p.slug, name: p.name, kind: p.kind, colors: p.colors } }));
  if (!svg.startsWith('<svg')) throw new Error(`ProductArt did not render an <svg> for ${p.slug}`);
  // Standalone .svg files need the namespace (inline SVG in HTML does not).
  if (!/^<svg[^>]*\sxmlns=/.test(svg)) svg = svg.replace('<svg', `<svg xmlns="${XMLNS}"`);
  writeFileSync(`${OUT}/${p.slug}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
}
console.log(`wrote ${PRODUCTS.length} product images to ${OUT}`);
