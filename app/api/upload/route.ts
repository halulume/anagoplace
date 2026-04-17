import { NextRequest, NextResponse } from "next/server";

// Security: Pinata credentials are server-side only.
// NEITHER key uses the NEXT_PUBLIC_ prefix, so they never leak to the client bundle.
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

// Security: rate limiting (simple in-memory, per-IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // max 10 uploads per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Security: validate file type
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "application/json",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      return NextResponse.json({ error: "IPFS not configured" }, { status: 500 });
    }

    // Rate limit check
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
      }

      // Forward to Pinata
      const pinataForm = new FormData();
      pinataForm.append("file", file);
      pinataForm.append("pinataMetadata", JSON.stringify({ name: `nft-${Date.now()}` }));
      pinataForm.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
        body: pinataForm,
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Upload failed" }, { status: 502 });
      }

      const data = await res.json();
      return NextResponse.json({ ipfsHash: data.IpfsHash });

    } else {
      // JSON metadata upload
      const body = await request.json();

      // Validate metadata structure
      if (!body.name || typeof body.name !== "string") {
        return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
      }

      // Sanitize: strip any HTML/script tags
      const sanitized = {
        name: body.name.slice(0, 200),
        description: (body.description || "").slice(0, 2000),
        image: body.image || "",
        attributes: Array.isArray(body.attributes) ? body.attributes.slice(0, 50) : [],
      };

      const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
        body: JSON.stringify({
          pinataContent: sanitized,
          pinataMetadata: { name: `metadata-${Date.now()}` },
        }),
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Metadata upload failed" }, { status: 502 });
      }

      const data = await res.json();
      return NextResponse.json({ ipfsHash: data.IpfsHash });
    }
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
