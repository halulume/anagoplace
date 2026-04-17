import axios from "axios";

const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud";

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  external_url?: string;
}

// Security: uploads go through our API route, secret key never exposed to browser
export async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Upload failed");
  }

  const data = await response.json();
  return `ipfs://${data.ipfsHash}`;
}

export async function uploadMetadataToIPFS(metadata: NFTMetadata): Promise<string> {
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Metadata upload failed");
  }

  const data = await response.json();
  return `ipfs://${data.ipfsHash}`;
}

export function ipfsToHttp(ipfsUrl: string): string {
  if (!ipfsUrl) return "/placeholder.png";
  if (ipfsUrl.startsWith("ipfs://")) {
    const hash = ipfsUrl.replace("ipfs://", "");
    return `${GATEWAY}/ipfs/${hash}`;
  }
  return ipfsUrl;
}

export async function fetchNFTMetadata(tokenURI: string): Promise<NFTMetadata | null> {
  try {
    const url = ipfsToHttp(tokenURI);
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch {
    return null;
  }
}
