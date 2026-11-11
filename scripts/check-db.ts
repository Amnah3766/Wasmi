// Connection check: connects with MONGODB_URI, builds any missing model indexes (never drops any) and prints the
// database name, what kind of cluster it is (no host names), collections, indexes and document counts.
// Never prints the connection string.
//   npm run db:check
import { connectDB, disconnectDB, MissingSecretError } from '../lib/db';
import { redactUri } from '../lib/errors';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { User } from '../models/User';

try {
  const conn = await connectDB();
  const c = conn.connection;
  await Promise.all([User.createIndexes(), Product.createIndexes(), Order.createIndexes(), Review.createIndexes()]);
  const host = c.host ?? '';
  const admin = c.db!.admin();
  const [hello, build] = await Promise.all([
    admin.command({ hello: 1 }).catch(() => ({}) as Record<string, unknown>),
    admin.command({ buildInfo: 1 }).catch(() => ({}) as Record<string, unknown>),
  ]);
  const members = Array.isArray(hello.hosts) ? hello.hosts.length : 0;
  console.log(`Connected ✓  database "${c.name}" on ${host.endsWith('.mongodb.net') ? 'MongoDB Atlas' : 'a MongoDB server'}`);
  console.log(
    `Cluster: MongoDB ${String(build.version ?? '?')} · ${members ? `replica set with ${members} member(s)` : 'standalone'} · primary reachable: ${hello.isWritablePrimary ? 'yes' : 'no'}`,
  );
  const collections = (await c.db!.listCollections().toArray()).map((x) => x.name).sort();
  console.log('Collections:', collections.join(', ') || '(none yet — run npm run seed)');
  for (const [name, m] of [
    ['products', Product],
    ['users', User],
    ['orders', Order],
    ['reviews', Review],
  ] as const) {
    const indexes = (await m.collection.indexes()).map((i) => `${Object.keys(i.key).join('+')}${i.unique ? ' (unique)' : ''}`);
    console.log(`${name}: ${await m.countDocuments()} document(s) · indexes: ${indexes.join(', ')}`);
  }
} catch (error) {
  if (error instanceof MissingSecretError) {
    console.error(`STOP: ${error.key} is not set. Add it to .env.local in the project root (local) and to the Netlify environment variables (production).`);
  } else {
    const e = error as Error;
    console.error(`Connection failed: ${e?.name ?? 'Error'}: ${redactUri(String(e?.message ?? error))}`);
  }
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => undefined);
}
