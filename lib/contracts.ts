import { parseAbi } from "viem";

export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`;
export const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;
export const ANAGO_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_ANAGO_TOKEN ||
  "0x5dF178C7E58046BC9074782fef0009C6Be167777") as `0x${string}`;

// Bean Exchange DEX on Monad Mainnet (chain 143)
export const LB_ROUTER_ADDRESS = "0x721aC9E688E6b86F48b08DB2ba2D4B7bBBd12665" as `0x${string}`;
export const LB_FACTORY_ADDRESS = "0x8Bb9727Ca742C146563DccBAFb9308A234e1d242" as `0x${string}`;
export const WMON_ADDRESS = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as `0x${string}`;

// ABIs
export const FACTORY_ABI = parseAbi([
  "function createCollection(string name, string symbol, uint256 maxSupply, string description, string image) external returns (address)",
  "function getUserCollections(address user) external view returns (address[])",
  "function getAllCollections() external view returns (address[])",
  "function getTotalCollections() external view returns (uint256)",
  "function getCollectionsPaginated(uint256 offset, uint256 limit) external view returns (address[], uint256)",
  "event CollectionCreated(address indexed owner, address indexed collection, string name, string symbol, uint256 maxSupply)",
]);

export const COLLECTION_ABI = parseAbi([
  "function mint(address to, string tokenURI) external returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function maxSupply() external view returns (uint256)",
  "function collectionDescription() external view returns (string)",
  "function collectionImage() external view returns (string)",
  "function getCollectionInfo() external view returns (string, string, uint256, uint256, string, string, address)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function owner() external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function approve(address to, uint256 tokenId) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "event NFTMinted(address indexed to, uint256 tokenId, string tokenURI)",
]);

export const MARKETPLACE_ABI = parseAbi([
  "function listNFT(address collection, uint256 tokenId, uint256 price) external",
  "function buyNFT(uint256 listingId) external",
  "function cancelListing(uint256 listingId) external",
  "function updatePrice(uint256 listingId, uint256 newPrice) external",
  "function getListing(uint256 listingId) external view returns ((uint256 id, address seller, address collection, uint256 tokenId, uint256 price, bool active))",
  "function getListingByNFT(address collection, uint256 tokenId) external view returns ((uint256 id, address seller, address collection, uint256 tokenId, uint256 price, bool active))",
  "function getActiveListings(uint256 offset, uint256 limit) external view returns ((uint256 id, address seller, address collection, uint256 tokenId, uint256 price, bool active)[], uint256)",
  "function listingCount() external view returns (uint256)",
  "function feePercent() external view returns (uint256)",
  "event Listed(uint256 indexed listingId, address indexed seller, address indexed collection, uint256 tokenId, uint256 price)",
  "event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, address collection, uint256 tokenId, uint256 price, uint256 fee)",
  "event Cancelled(uint256 indexed listingId)",
]);

// Bean Exchange LBFactory ABI (minimal)
export const LB_FACTORY_ABI = parseAbi([
  "function getAllLBPairs(address tokenX, address tokenY) external view returns ((uint16 binStep, address LBPair, bool createdByOwner, bool ignoredForRouting)[] lbPairsAvailable)",
]);

// Bean Exchange LBRouter ABI (minimal)
export const LB_ROUTER_ABI = parseAbi([
  "function swapExactNATIVEForTokens(uint256 amountOutMin, (uint256[] pairBinSteps, address[] tokenPath) path, address to, uint256 deadline) external payable returns (uint256 amountOut)",
  "function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMinNATIVE, (uint256[] pairBinSteps, address[] tokenPath) path, address to, uint256 deadline) external returns (uint256 amountOut)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (uint256[] pairBinSteps, address[] tokenPath) path, address to, uint256 deadline) external returns (uint256 amountOut)",
]);

// LBPair ABI (for quote)
export const LB_PAIR_ABI = parseAbi([
  "function getSwapOut(uint128 amountIn, bool swapForY) external view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)",
  "function getTokenX() external view returns (address tokenX)",
  "function getTokenY() external view returns (address tokenY)",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
]);

export type Listing = {
  id: bigint;
  seller: `0x${string}`;
  collection: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
};
