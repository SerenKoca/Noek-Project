import mongoose from 'mongoose'

let cached = globalThis.__noekMongoose

if (!cached) {
  cached = globalThis.__noekMongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL

  if (!mongoUri) {
    throw new Error('Missing MONGO_URI')
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri).then((mongooseInstance) => mongooseInstance)
  }

  cached.conn = await cached.promise
  return cached.conn
}
