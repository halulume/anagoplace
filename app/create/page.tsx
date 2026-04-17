"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi } from "viem";
import { FACTORY_ADDRESS, FACTORY_ABI, COLLECTION_ABI } from "@/lib/contracts";
import { uploadImageToIPFS, uploadMetadataToIPFS } from "@/lib/ipfs";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Upload, Image as ImageIcon, Plus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "collection" | "mint";

export default function CreatePage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>("collection");

  // Collection state
  const [collectionName, setCollectionName] = useState("");
  const [collectionSymbol, setCollectionSymbol] = useState("");
  const [collectionDesc, setCollectionDesc] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [collectionImage, setCollectionImage] = useState<File | null>(null);
  const [collectionImagePreview, setCollectionImagePreview] = useState("");
  const [createdCollection, setCreatedCollection] = useState<`0x${string}` | null>(null);

  // NFT state
  const [nftName, setNftName] = useState("");
  const [nftDesc, setNftDesc] = useState("");
  const [nftImage, setNftImage] = useState<File | null>(null);
  const [nftImagePreview, setNftImagePreview] = useState("");
  const [attributes, setAttributes] = useState([{ trait_type: "", value: "" }]);

  const [isCreating, setIsCreating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Collection image drop
  const onDropCollection = useCallback((files: File[]) => {
    const file = files[0];
    setCollectionImage(file);
    setCollectionImagePreview(URL.createObjectURL(file));
  }, []);
  const { getRootProps: getColRootProps, getInputProps: getColInputProps, isDragActive: isColDrag } = useDropzone({
    onDrop: onDropCollection,
    accept: { "image/*": [] },
    maxFiles: 1,
  });

  // NFT image drop
  const onDropNFT = useCallback((files: File[]) => {
    const file = files[0];
    setNftImage(file);
    setNftImagePreview(URL.createObjectURL(file));
  }, []);
  const { getRootProps: getNFTRootProps, getInputProps: getNFTInputProps, isDragActive: isNFTDrag } = useDropzone({
    onDrop: onDropNFT,
    accept: { "image/*": [] },
    maxFiles: 1,
  });

  async function handleCreateCollection() {
    if (!isConnected) return toast.error("Connect Your Wallet");
    if (!collectionName || !collectionSymbol) return toast.error("Please enter name and symbol");

    setIsCreating(true);
    const toastId = toast.loading("Creating collection...");

    try {
      let imageURI = "";
      if (collectionImage) {
        toast.loading("Uploading image to IPFS...", { id: toastId });
        imageURI = await uploadImageToIPFS(collectionImage);
      }

      toast.loading("Signing transaction...", { id: toastId });
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createCollection",
        args: [
          collectionName,
          collectionSymbol.toUpperCase(),
          BigInt(maxSupply || "0"),
          collectionDesc,
          imageURI,
        ],
      });

      toast.loading("Confirming transaction...", { id: toastId });

      // Poll for receipt
      await new Promise((resolve) => setTimeout(resolve, 3000));
      toast.success("Collection created!", { id: toastId });
      setStep("mint");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg.slice(0, 100), { id: toastId });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleMintNFT() {
    if (!isConnected) return toast.error("Connect Your Wallet");
    if (!createdCollection) return toast.error("Please enter collection address");
    if (!nftName) return toast.error("Please enter NFT name");
    if (!nftImage) return toast.error("Please upload an image");

    setIsMinting(true);
    const toastId = toast.loading("Minting NFT...");

    try {
      toast.loading("Uploading image to IPFS...", { id: toastId });
      const imageURI = await uploadImageToIPFS(nftImage);

      toast.loading("Uploading metadata...", { id: toastId });
      const validAttrs = attributes.filter((a) => a.trait_type && a.value);
      const metadataURI = await uploadMetadataToIPFS({
        name: nftName,
        description: nftDesc,
        image: imageURI,
        attributes: validAttrs,
      });

      toast.loading("Signing transaction...", { id: toastId });
      await writeContractAsync({
        address: createdCollection,
        abi: COLLECTION_ABI,
        functionName: "mint",
        args: [address!, metadataURI],
      });

      toast.success("NFT minted successfully!", { id: toastId });
      setNftName("");
      setNftDesc("");
      setNftImage(null);
      setNftImagePreview("");
      setAttributes([{ trait_type: "", value: "" }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg.slice(0, 100), { id: toastId });
    } finally {
      setIsMinting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-32 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h2>
        <p className="text-gray-500">You need to connect your wallet to create a collection.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-10">
        {["collection", "mint"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className={cn("flex-1 h-px w-12", step === "mint" ? "bg-monad-500" : "bg-dark-200")} />}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              step === s ? "bg-monad-500 text-white" : "bg-dark-100 text-gray-500"
            )}>
              {step === "mint" && s === "collection"
                ? <Check size={15} />
                : <span>{i + 1}</span>
              }
              {s === "collection" ? "Create Collection" : "Mint NFT"}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Collection */}
      {step === "collection" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Create a Collection</h1>
            <p className="text-gray-500 text-sm mt-1">Deploy your own NFT collection smart contract</p>
          </div>

          {/* Collection Image */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Collection Image</label>
            <div
              {...getColRootProps()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
                isColDrag ? "border-monad-500 bg-monad-500/10" : "border-monad-500/20 hover:border-monad-500/40"
              )}
            >
              <input {...getColInputProps()} />
              {collectionImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={collectionImagePreview} alt="preview" className="w-32 h-32 object-cover rounded-xl mx-auto" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <ImageIcon size={32} />
                  <p className="text-sm">Drag & drop or click to upload</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Collection Name *</label>
              <input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="My Collection"
                className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Symbol *</label>
              <input
                value={collectionSymbol}
                onChange={(e) => setCollectionSymbol(e.target.value.toUpperCase())}
                placeholder="MYC"
                maxLength={8}
                className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Description</label>
            <textarea
              value={collectionDesc}
              onChange={(e) => setCollectionDesc(e.target.value)}
              placeholder="Describe your collection..."
              rows={3}
              className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">
              Max Supply <span className="text-gray-600">(0 = Unlimited)</span>
            </label>
            <input
              type="number"
              value={maxSupply}
              onChange={(e) => setMaxSupply(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
            />
          </div>

          <button
            onClick={handleCreateCollection}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 bg-monad-500 hover:bg-monad-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {isCreating ? "Creating..." : "Create Collection"}
          </button>
        </div>
      )}

      {/* Step 2: Mint NFT */}
      {step === "mint" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Mint NFT</h1>
            <p className="text-gray-500 text-sm mt-1">Mint NFTs to your collection</p>
          </div>

          {/* Collection address input */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Collection Address *</label>
            <input
              value={createdCollection || ""}
              onChange={(e) => setCreatedCollection(e.target.value as `0x${string}`)}
              placeholder="0x... (Contract address you just created)"
              className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600 font-mono"
            />
          </div>

          {/* NFT Image */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">NFT Image *</label>
            <div
              {...getNFTRootProps()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
                isNFTDrag ? "border-monad-500 bg-monad-500/10" : "border-monad-500/20 hover:border-monad-500/40"
              )}
            >
              <input {...getNFTInputProps()} />
              {nftImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={nftImagePreview} alt="preview" className="w-40 h-40 object-cover rounded-xl mx-auto" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload size={32} />
                  <p className="text-sm">Upload NFT Image</p>
                  <p className="text-xs text-gray-600">Supports PNG, JPG, GIF, MP4</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">NFT Name *</label>
            <input
              value={nftName}
              onChange={(e) => setNftName(e.target.value)}
              placeholder="My NFT #1"
              className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Description</label>
            <textarea
              value={nftDesc}
              onChange={(e) => setNftDesc(e.target.value)}
              placeholder="Describe your NFT..."
              rows={3}
              className="w-full bg-dark-100 border border-monad-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600 resize-none"
            />
          </div>

          {/* Attributes */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Attributes (optional)</label>
            {attributes.map((attr, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={attr.trait_type}
                  onChange={(e) => {
                    const newAttrs = [...attributes];
                    newAttrs[i].trait_type = e.target.value;
                    setAttributes(newAttrs);
                  }}
                  placeholder="Trait type"
                  className="flex-1 bg-dark-100 border border-monad-500/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
                />
                <input
                  value={attr.value}
                  onChange={(e) => {
                    const newAttrs = [...attributes];
                    newAttrs[i].value = e.target.value;
                    setAttributes(newAttrs);
                  }}
                  placeholder="Value"
                  className="flex-1 bg-dark-100 border border-monad-500/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-monad-500/50 placeholder-gray-600"
                />
              </div>
            ))}
            <button
              onClick={() => setAttributes([...attributes, { trait_type: "", value: "" }])}
              className="text-monad-400 text-sm hover:text-monad-300 flex items-center gap-1 mt-1"
            >
              <Plus size={14} /> Add attribute
            </button>
          </div>

          <button
            onClick={handleMintNFT}
            disabled={isMinting}
            className="w-full flex items-center justify-center gap-2 bg-monad-500 hover:bg-monad-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {isMinting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {isMinting ? "Minting..." : "Mint NFT"}
          </button>
        </div>
      )}
    </div>
  );
}
