import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db("waitlist");
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export default async function handler(req, res) {
  // CORS - Set headers before any response
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      message: "Waitlist API endpoint",
      usage: "POST to this endpoint with email, fullname, and position fields"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, fullname, position } = req.body;

    if (!email || !fullname || !position) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // DB
    const { db } = await connectToDatabase();
    const collection = db.collection("submissions");

    // Check duplicates
    const existing = await collection.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Insert
    const result = await collection.insertOne({
      email: email.toLowerCase(),
      fullname,
      position,
      created_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Successfully added to waitlist",
      data: {
        id: result.insertedId,
        email: email.toLowerCase(),
        fullname,
        position,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to add to waitlist",
      details: error.message
    });
  }
}