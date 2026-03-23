import bcrypt from 'bcryptjs';

export async function hashPassword(plain) {
  const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

