export type Rarity = "Basic" | "Rare" | "Epic" | "Legendary" | "Mystic";

export interface RarityConfig {
  label: string;
  /** Tailwind gradient classes for the rarity badge */
  badgeGradient: string;
  /** CSS class name applied to the card wrapper */
  cssClass: string;
  /** Hex color used for detail-page image border inline style */
  borderColor: string;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  Basic: {
    label: "Basic",
    badgeGradient: "",
    cssClass: "",
    borderColor: "transparent",
  },
  Rare: {
    label: "Rare",
    badgeGradient: "from-blue-500 to-cyan-400",
    cssClass: "rarity-rare",
    borderColor: "#3B82F6",
  },
  Epic: {
    label: "Epic",
    badgeGradient: "from-purple-500 to-violet-500",
    cssClass: "rarity-epic",
    borderColor: "#A855F7",
  },
  Legendary: {
    label: "Legendary",
    badgeGradient: "from-orange-400 to-amber-500",
    cssClass: "rarity-legendary",
    borderColor: "#F97316",
  },
  Mystic: {
    label: "Mystic",
    badgeGradient: "from-red-500 to-rose-500",
    cssClass: "rarity-mystic",
    borderColor: "#EF4444",
  },
};

/**
 * Reads the "Rarity" trait from NFT metadata attributes.
 * Falls back to "Basic" when not found.
 */
export function getRarity(
  attributes?: Array<{ trait_type: string; value: string | number }>
): Rarity {
  if (!attributes) return "Basic";
  const attr = attributes.find(
    (a) => a.trait_type.toLowerCase() === "rarity"
  );
  if (!attr) return "Basic";
  const raw = String(attr.value).trim();
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (cap === "Rare") return "Rare";
  if (cap === "Epic") return "Epic";
  if (cap === "Legendary") return "Legendary";
  if (cap === "Mystic") return "Mystic";
  return "Basic";
}
