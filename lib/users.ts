// The only user fields ever sent to the browser — never passwordHash.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
}

export function publicUser(doc: { _id: unknown; name: string; email: string; createdAt?: Date | string | null }): PublicUser {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}
