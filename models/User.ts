// User account. SKILL.md fields: name, email (unique), passwordHash, createdAt.
// - email is stored trimmed + lowercased, so "Ali@Example.com" and "ali@example.com" are the same account.
// - passwordHash holds a bcrypt hash only (cost 12, "$2b$12$…"; never the plain password). It is excluded from queries
//   by default (select: false) and from every JSON/object serialisation.
import mongoose, { type Model, type Types } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface UserFields {
  name: string;
  email: string;
  passwordHash: string;
  createdAt?: Date;
}

export type UserDoc = UserFields & { _id: Types.ObjectId };

const stripSecrets = (_doc: unknown, ret: Record<string, unknown>) => {
  delete ret.passwordHash;
  delete ret.__v;
  return ret;
};

const UserSchema = new Schema<UserFields>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: stripSecrets },
    toObject: { transform: stripSecrets },
  },
);

export const User: Model<UserFields> = (models.User as Model<UserFields> | undefined) ?? model<UserFields>('User', UserSchema);
