// Seeds (or re-syncs) the Wasmi catalog and the sample reviews into MongoDB Atlas.
//   npm run seed
// Repeatable and non-destructive: products are upserted by their unique slug and sample reviews by their unique
// sampleKey (bulkWrite), so running it again updates the same documents instead of creating duplicates. It never
// deletes anything (customer reviews, users and orders are untouched). Never prints the connection string.
import { connectDB, disconnectDB, MissingSecretError } from '../lib/db';
import { redactUri } from '../lib/errors';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { PRODUCTS } from './seed/products-data';
import { SEED_REVIEWS } from './seed/reviews-data';

const MISSING_URI = [
  'STOP: MONGODB_URI is not set.',
  'Add ONE line to the file .env.local in the project root (copy .env.example):',
  '  MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/wasmi?retryWrites=true&w=majority',
  'Get it from MongoDB Atlas → your cluster → Connect → Drivers. (On Netlify: Site settings → Environment variables.)',
].join('\n');

async function main() {
  if (!process.env.MONGODB_URI) throw new MissingSecretError('MONGODB_URI');
  await connectDB();
  // createIndexes builds missing indexes (unique slug / sampleKey) and never drops existing ones.
  await Promise.all([Product.createIndexes(), Review.createIndexes()]);

  // Validate every document against the schema before writing anything.
  for (const p of PRODUCTS) await new Product(p).validate();

  const productResult = await Product.bulkWrite(
    PRODUCTS.map((p) => ({ updateOne: { filter: { slug: p.slug }, update: { $set: { ...p } }, upsert: true } })),
    { ordered: true },
  );

  const ids = new Map(
    (await Product.find({ slug: { $in: PRODUCTS.map((p) => p.slug) } }).select('_id slug').lean<Array<{ _id: unknown; slug: string }>>()).map(
      (p) => [p.slug, p._id],
    ),
  );
  const reviewDocs = SEED_REVIEWS.map((r) => {
    const product = ids.get(r.productSlug);
    if (!product) throw new Error(`Sample review ${r.sampleKey} points to unknown product "${r.productSlug}".`);
    return { ...r, product, user: null, sample: true };
  });
  for (const r of reviewDocs) await new Review(r).validate();
  const reviewResult = await Review.bulkWrite(
    reviewDocs.map((r) => ({ updateOne: { filter: { sampleKey: r.sampleKey }, update: { $set: r }, upsert: true } })),
    { ordered: true },
  );

  const [productTotal, sampleTotal, reviewTotal] = await Promise.all([
    Product.countDocuments(),
    Review.countDocuments({ sample: true }),
    Review.countDocuments(),
  ]);
  console.log(
    `products: inserted ${productResult.upsertedCount}, updated ${productResult.matchedCount} · total in database: ${productTotal}`,
  );
  console.log(
    `sample reviews: inserted ${reviewResult.upsertedCount}, updated ${reviewResult.matchedCount} · samples: ${sampleTotal}, all reviews: ${reviewTotal}`,
  );
  console.log('Seed complete ✓');
}

try {
  await main();
} catch (error) {
  if (error instanceof MissingSecretError) console.error(MISSING_URI);
  else {
    const e = error as Error;
    console.error(`Seed failed: ${e?.name ?? 'Error'}: ${redactUri(String(e?.message ?? error))}`);
  }
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => undefined);
}
