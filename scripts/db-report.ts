// Read-only report of what is stored in MongoDB Atlas, for the classwork screenshot.
//   npm run db:report   → prints a summary and writes db-report.html (git-ignored) in the project root
// Shows products / users / orders (+ reviews count). Never includes a full password hash, a password, a token or the
// connection string: emails are masked and hashes are cut to their first 7 characters ("$2b$12$…").
import { writeFileSync } from 'node:fs';
import { connectDB, disconnectDB, MissingSecretError } from '../lib/db';
import { redactUri } from '../lib/errors';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { User } from '../models/User';
import { hashPreview, maskEmail, renderDbReport } from './report-html';

const LIMIT = 50;

try {
  const conn = await connectDB();
  const [products, users, orders, reviewTotal, reviewSamples, userTotal, orderTotal] = await Promise.all([
    Product.find({}).sort({ sortOrder: 1 }).select('slug name category price seasons allYear').lean(),
    User.find({}).select('+passwordHash name email createdAt').sort({ createdAt: -1 }).limit(LIMIT).lean(),
    Order.find({}).sort({ createdAt: -1 }).limit(LIMIT).populate<{ user: { name?: string } | null }>('user', 'name').lean(),
    Review.countDocuments(),
    Review.countDocuments({ sample: true }),
    User.countDocuments(),
    Order.countDocuments(),
  ]);

  const hashes = users.map((u) => String(u.passwordHash ?? ''));
  const allBcrypt = hashes.every((h) => /^\$2b\$12\$[./A-Za-z0-9]{53}$/.test(h));
  console.log(`Database "${conn.connection.name}"${(conn.connection.host ?? '').endsWith('.mongodb.net') ? ' on MongoDB Atlas' : ''}`);
  console.log(`products: ${products.length} · users: ${userTotal} · orders: ${orderTotal} · reviews: ${reviewTotal} (${reviewSamples} samples)`);
  console.log(`every passwordHash is bcrypt cost 12 ($2b$12$, 60 chars): ${users.length ? (allBcrypt ? 'YES' : 'NO') : '(no users yet)'}`);
  if (hashes.length) console.log(`hash prefixes: ${hashes.slice(0, 3).map(hashPreview).join(', ')}`);

  const html = renderDbReport({
    database: conn.connection.name,
    atlas: (conn.connection.host ?? '').endsWith('.mongodb.net'),
    generatedAt: new Date(),
    products: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      price: p.price,
      seasons: [...(p.seasons ?? [])],
      allYear: Boolean(p.allYear),
    })),
    // Hashes are shortened HERE, before they reach the HTML builder.
    users: users.map((u) => ({ name: u.name, email: u.email, passwordHash: String(u.passwordHash ?? '').slice(0, 7), createdAt: u.createdAt ?? null })),
    orders: orders.map((o) => ({
      orderNo: o.orderNo,
      userName: o.user?.name ?? '(حساب محذوف)',
      itemsCount: (o.items ?? []).reduce((n, i) => n + (i.quantity ?? 0), 0),
      total: o.total,
      status: o.status,
      createdAt: o.createdAt ?? null,
    })),
    reviews: { total: reviewTotal, samples: reviewSamples },
  });
  writeFileSync('db-report.html', html);
  console.log(`wrote db-report.html (newest ${LIMIT} users/orders; emails masked: e.g. ${users[0] ? maskEmail(users[0].email) : 'n/a'})`);
} catch (error) {
  if (error instanceof MissingSecretError) {
    console.error(`STOP: ${error.key} is not set. Add it to .env.local in the project root.`);
  } else {
    const e = error as Error;
    console.error(`Report failed: ${e?.name ?? 'Error'}: ${redactUri(String(e?.message ?? error))}`);
  }
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => undefined);
}
