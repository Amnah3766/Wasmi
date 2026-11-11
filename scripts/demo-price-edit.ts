// Classwork evidence helper: changes one product's price directly in MongoDB Atlas (as if edited in the Atlas UI) so
// you can refresh the site and see the new price, then puts the seed price back.
//   npm run seed && node --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx scripts/demo-price-edit.ts --slug awal --price 10.25
//   ... scripts/demo-price-edit.ts --slug awal --restore
// Only the `price` field of that one product is touched. Never prints the connection string.
import { connectDB, disconnectDB, MissingSecretError } from '../lib/db';
import { redactUri } from '../lib/errors';
import { fmt } from '../lib/shop/pricing';
import { Product } from '../models/Product';
import { PRODUCTS } from './seed/products-data';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

try {
  const slug = arg('slug') ?? 'awal';
  const restore = process.argv.includes('--restore');
  const seed = PRODUCTS.find((p) => p.slug === slug);
  if (!seed) throw new Error(`Unknown slug "${slug}". Use one of: ${PRODUCTS.map((p) => p.slug).join(', ')}`);
  const price = restore ? seed.price : Number(arg('price'));
  if (!Number.isFinite(price) || price < 0 || Math.round(price * 1000) / 1000 !== price) {
    throw new Error('Give a price in KWD with at most 3 decimals, e.g. --price 10.25 (or use --restore).');
  }

  await connectDB();
  const before = await Product.findOne({ slug }).select('price name').lean<{ price: number; name: string }>();
  if (!before) throw new Error(`Product "${slug}" is not in the database yet — run npm run seed first.`);
  await Product.updateOne({ slug }, { $set: { price } }, { runValidators: true });
  console.log(`${restore ? 'Restored' : 'Atlas edit applied'}: ${slug} (${before.name}) price ${fmt(before.price)} → ${fmt(price)}`);
  console.log('Refresh the product page to see the price that now comes from the database.');
} catch (error) {
  if (error instanceof MissingSecretError) console.error(`STOP: ${error.key} is not set. Add it to .env.local in the project root.`);
  else console.error(`Price edit failed: ${redactUri(String((error as Error)?.message ?? error))}`);
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => undefined);
}
