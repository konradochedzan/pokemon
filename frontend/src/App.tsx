/*  App.tsx – frontend adapted for *escrow* TradingWithAuctions
    – fetches public listings correctly
    – live-updates on marketplace events                                   */

import React, { useState, useEffect, useCallback } from "react";
import { ethers, BrowserProvider, parseEther } from "ethers";

import PokemonNFTArtifact from "./abis/PokemonNFT.json";
import TradingArtifact from "./abis/TradingWithAuctions.json";

const PokemonNFTAbi = PokemonNFTArtifact.abi;
const TradingAbi = TradingArtifact.abi;

/* ─── deployed addresses (Hardhat local) ─────────────────────────────── */
const PokemonNFTAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TradingAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

/* ─── component ──────────────────────────────────────────────────────── */
export default function CompleteFrontend() {
    /* -- general state -- */
    const [provider, setProvider] = useState<BrowserProvider>();
    const [signer, setSigner] = useState<ethers.Signer>();
    const [userAddress, setUserAddress] = useState<string>();

    /* -- contracts -- */
    const [pokemonNFTContract, setPokemonNFT] = useState<ethers.Contract>();
    const [tradingContract, setTrading] = useState<ethers.Contract>();

    /* -- UI state -- */
    const [consoleLog, setConsoleLog] = useState<string>("");

    /* mystery-box */
    const [boxPrice, setBoxPrice] = useState<string>("0.01");

    /* listing params */
    const [tokenIdForSale, setTokenIdForSale] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [saleType, setSaleType] = useState<"FixedPrice" | "Auction">("FixedPrice");
    const [auctionEndTime, setAuctionEndTime] = useState("");

    /* buy / bid / finalize params */
    const [tokenIdToBuy, setTokenIdToBuy] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [tokenIdToBid, setTokenIdToBid] = useState("");
    const [bidAmount, setBidAmount] = useState("");
    const [tokenIdToFin, setTokenIdToFin] = useState("");
    const [tokenIdToCancel, setTokenIdToCancel] = useState("");

    /* data -- owned + public */
    const [ownedTokens, setOwned] = useState<any[]>([]);
    const [listedTokens, setListed] = useState<any[]>([]);
    const [finalizedCache, setFinalizedCache] = useState<Set<string>>(new Set());
    const [isConnecting, setIsConnecting] = useState(false);
    /* ─── helper: log to on-screen console ─────────────────────────────── */
    const pushLog = (msg: string) => setConsoleLog(prev => prev + "\n" + msg);

    useEffect(() => {
        const timer = setInterval(() => {
            setListed((prev) => [...prev]); // trigger re-render
        }, 1000);
        return () => clearInterval(timer);
    }, []);


    function normalizeAttrs(raw: any) {
        return {
            name: raw.name,
            gender: raw.gender,
            pokemonType: raw.pokemonType,
            spAttack: raw.spAttack,
            spDefense: raw.spDefense,
            level: Number(raw.level),
            hp: Number(raw.hp),
            attack: Number(raw.attack),
            defense: Number(raw.defense),
            speed: Number(raw.speed),
            purity: Number(raw.purity)
        };
    }

    function formatCountdown(secondsLeft: number): string {
        if (secondsLeft <= 0) return "Expired";

        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;

        return `${hours}h ${minutes}m ${seconds}s`;
    }
    /* ─── fetch owned pokémon ──────────────────────────────────────────── */
    const fetchOwnedPokemon = useCallback(
        async (nft: ethers.Contract, addr: string) => {
            try {
                const bal = await nft.balanceOf(addr);
                const temp: any[] = [];
                for (let i = 0; i < bal; i++) {
                    const tid = await nft.tokenOfOwnerByIndex(addr, i);
                    const attrs = await nft.getPokemonAttributes(tid);
                    temp.push({
                        tokenId: tid.toString(),
                        ...normalizeAttrs(attrs)
                    });
                }
                setOwned(temp);
            } catch (e: any) { console.error(e); pushLog("Could not fetch owned Pokémon"); }
        }, []
    );

    /* ─── fetch public listings (escrow) ───────────────────────────────── */
    const fetchPublicListings = useCallback(
        async (mkt: ethers.Contract, nft: ethers.Contract) => {
            if (!mkt || !nft) return;

            try {
                const tids: bigint[] = await mkt.getAllListedTokenIds(PokemonNFTAddress);

                // Delete duplicates on the entrance
                const uniq = [...new Set(tids.map(t => t.toString()))];

                const list: any[] = [];

                for (const id of uniq) {
                    try {
                        const tid = BigInt(id);
                        const li = await mkt.listings(PokemonNFTAddress, tid);
                        const att = await nft.getPokemonAttributes(tid);

                        // Skip empty listings
                        if (li.seller === ethers.ZeroAddress) continue;

                        const saleTypeEnum = Number(li.saleType); // 0 = Auction, 1 = FixedPrice
                        const isAuction = saleTypeEnum === 1;

                        const bidOrPrice =
                            isAuction && li.highestBid > 0n ? li.highestBid : li.price;
                        const priceEth = ethers.formatEther(bidOrPrice);

                        list.push({
                            tokenId: tid.toString(),
                            price: priceEth,
                            saleType: isAuction ? "Auction" : "FixedPrice",
                            endTime: Number(li.endTime),
                            seller: li.seller.toLowerCase(),
                            highestBidder: li.highestBidder.toLowerCase(),
                            highestBid: li.highestBid,
                            ...normalizeAttrs(att)
                        });
                    } catch (e) {
                        console.error(`Failed to load token ${id}:`, e);
                    }
                }

                setListed(list);
            } catch (e: any) {
                console.error("❌ fetchPublicListings error:", e);
                pushLog(`❌ Failed to fetch public listings: ${e?.reason || e?.message}`);
            }
        },
        []
    );


    useEffect(() => {
        if (!tradingContract || !pokemonNFTContract) return;

        const timer = setInterval(async () => {
            const now = Date.now() / 1e3;

            const candidates = listedTokens.filter(
                l =>
                    l.saleType === "Auction" &&
                    l.endTime <= now &&
                    !finalizedCache.has(l.tokenId)
            );

            if (candidates.length === 0) return;

            for (const l of candidates) {
                try {

                    await tradingContract.callStatic.finalizeAuction(
                        PokemonNFTAddress,
                        l.tokenId
                    );

                    /* 2️⃣  właściwa transakcja */
                    const tx = await tradingContract.finalizeAuction(
                        PokemonNFTAddress,
                        l.tokenId
                    );
                    pushLog(`⏳ Finalizing auction #${l.tokenId}…`);
                    await tx.wait();
                    pushLog(`🏁 Auction #${l.tokenId} finalized!`);


                } catch (e: any) {

                    if (!/Listing.*active|Auction/i.test(e?.reason || "")) console.error(e);
                } finally {

                    setFinalizedCache(prev => new Set(prev).add(l.tokenId));
                }
            }
            await fetchPublicListings(tradingContract, pokemonNFTContract);
            if (userAddress) await fetchOwnedPokemon(pokemonNFTContract, userAddress);
        }, 15_000);

        return () => clearInterval(timer);
    }, [
        listedTokens,
        tradingContract,
        pokemonNFTContract,
        fetchPublicListings,
        fetchOwnedPokemon,
        userAddress,
        finalizedCache
    ]);

    /* ─── connect wallet ───────────────────────────────────────────────── */
    const connectWallet = async () => {
        if (!window.ethereum) { alert("Install MetaMask"); return; }

        // 1️⃣ Protection against multiple clicking
        if (isConnecting || userAddress) return;
        setIsConnecting(true);

        try {
            const tempProv = new BrowserProvider(window.ethereum);

            const already = await tempProv.send("eth_accounts", []);
            if (already.length === 0) {
                try {

                    await tempProv.send("eth_requestAccounts", []);
                } catch (e: any) {

                    if (e.code === -32002) {
                        pushLog("🕑 MetaMask connection is pending – accept it or close the window.");
                        return;
                    }
                    throw e;
                }
            }


            const tempSigner = await tempProv.getSigner();
            const addr = (await tempSigner.getAddress()).toLowerCase();

            setProvider(tempProv);
            setSigner(tempSigner);
            setUserAddress(addr);
            pushLog(`✅ Connected as ${addr}`);

            const nft = new ethers.Contract(PokemonNFTAddress, PokemonNFTAbi, tempSigner);
            const mkt = new ethers.Contract(TradingAddress, TradingAbi, tempSigner);
            setPokemonNFT(nft);
            setTrading(mkt);


            await Promise.all([
                fetchOwnedPokemon(nft, addr),
                fetchPublicListings(mkt, nft)
            ]);

        } catch (e: any) {
            console.error(e);
            pushLog(`❌ ${e?.reason || e?.message}`);
        } finally {
            setIsConnecting(false);
        }
    };



    /* ─── event listeners – refresh marketplace automatically ──────────── */
    useEffect(() => {
        if (!tradingContract || !pokemonNFTContract) return;

        const refresh = () => fetchPublicListings(tradingContract, pokemonNFTContract);

        tradingContract.on("Listed", refresh);
        tradingContract.on("Listed", () => {
            if (userAddress) fetchOwnedPokemon(pokemonNFTContract, userAddress);
        });
        tradingContract.on("Purchase", refresh);
        tradingContract.on("Cancelled", refresh);
        tradingContract.on("AuctionFinalized", refresh);

        return () => {
            tradingContract.off("Listed", refresh);
            tradingContract.off("Purchase", refresh);
            tradingContract.off("Cancelled", refresh);
            tradingContract.off("AuctionFinalized", refresh);
        };
    }, [tradingContract, pokemonNFTContract, fetchPublicListings]);

    /* ─── mystery box ──────────────────────────────────────────────────── */
    const openMysteryBox = async () => {
        if (!pokemonNFTContract || !signer) return pushLog("Not connected");
        try {
            const res = await fetch("http://localhost:3001/sign", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userAddress })
            });
            const p = await res.json();

            const tx = await pokemonNFTContract.openMysteryBox(
                p.name, p.gender, p.pokemonType, p.spAttack, p.spDefense,
                p.level, p.hp, p.attack, p.defense, p.speed, p.purity,
                p.signature,
                { value: parseEther(boxPrice) }
            );
            await tx.wait();
            pushLog("🎉 Mystery box opened!");
            fetchOwnedPokemon(pokemonNFTContract, userAddress!);
        } catch (e: any) { console.error(e); pushLog(e.message); }
    };

    /* ─── list NFT (escrow) ────────────────────────────────────────────── */
    const listNFT = async () => {
        if (!tradingContract || !pokemonNFTContract) return;
        try {
            await pokemonNFTContract.approve(TradingAddress, tokenIdForSale);
            const enumVal = saleType === "Auction" ? 1 : 0;
            const priceWei = parseEther(salePrice);
            const endUnix = saleType === "Auction"
                ? Math.floor(Date.now() / 1000) + Number(auctionEndTime) * 60
                : 0;
            const tx = await tradingContract.listItem(
                PokemonNFTAddress,
                tokenIdForSale,
                priceWei,
                enumVal,
                endUnix
            );
            await tx.wait();
            pushLog("✅ Listed!");
            await Promise.all([
                fetchPublicListings(tradingContract, pokemonNFTContract),
                userAddress && fetchOwnedPokemon(pokemonNFTContract, userAddress)
            ]);
        } catch (e: any) { console.error(e); pushLog(e.message); }
    };

    /* ─── buy fixed price ──────────────────────────────────────────────── */
    const buyNFT = async () => {
        if (!tradingContract || !pokemonNFTContract || !userAddress) return;
        try {
            const tx = await tradingContract.buyItem(
                PokemonNFTAddress,
                tokenIdToBuy,
                { value: parseEther(buyPrice) }
            );
            await tx.wait();
            pushLog(`🛒 Bought token #${tokenIdToBuy}`);

            await Promise.all([
                fetchPublicListings(tradingContract, pokemonNFTContract),
                fetchOwnedPokemon(pokemonNFTContract, userAddress)
            ]);
        } catch (e: any) {
            console.error(e);
            pushLog(e.message);
        }
    };

    /* ─── bid & finalize ──────────────────────────────────────────────── */
    const placeBid = async () => {
        if (!tradingContract) return;
        try {
            const tx = await tradingContract.placeBid(
                PokemonNFTAddress,
                tokenIdToBid,
                { value: parseEther(bidAmount) }
            );
            await tx.wait();
            pushLog("💰 Bid placed");
            await fetchPublicListings(tradingContract, pokemonNFTContract)
        } catch (e: any) { console.error(e); pushLog(e.message); }
    };

    const finalizeAuction = async () => {
        if (!tradingContract) return;
        try {
            const tx = await tradingContract.finalizeAuction(PokemonNFTAddress, tokenIdToFin);
            await tx.wait();
            pushLog("🏁 Auction finalized");
            await fetchPublicListings(tradingContract, pokemonNFTContract);
            await fetchOwnedPokemon(pokemonNFTContract, userAddress!);
        } catch (e: any) { console.error(e); pushLog(e.message); }
    };
    const cancelListing = async (tokenId: string) => {
        if (!tradingContract || !pokemonNFTContract) return;
        try {
            const tx = await tradingContract.cancelListing(PokemonNFTAddress, tokenId);
            await tx.wait();

            pushLog(`🗑 Listing for token #${tokenId} cancelled`);

            // refresh UI
            await fetchOwnedPokemon(pokemonNFTContract, userAddress!);
            await fetchPublicListings(tradingContract, pokemonNFTContract);
        } catch (e: any) {
            console.error(e);
            const msg = e?.reason || e?.message || "";
            if (msg.includes("Not seller")) {
                pushLog("That listing wasn't created by you");
            } else {
                pushLog(`❌ Cancel failed: ${msg}`);
            }
        }

    };

    /* ─── JSX ─────────────────────────────────────────────────────────── */
    return (
        <div className="p-4 space-y-4">
            <h1 className="text-3xl font-bold">Pokémon Marketplace</h1>

            {!userAddress &&
                <button className="bg-blue-500 text-white rounded p-2" onClick={connectWallet}>
                    Connect MetaMask
                </button>}
            <p>Wallet: {userAddress ?? "—"}</p>

            {/* console */}
            <pre className="bg-gray-200 p-2 h-32 overflow-auto rounded">{consoleLog}</pre>

            {/* mystery box */}
            <section className="border p-4 rounded">
                <h2 className="font-semibold">Open Mystery Box ({boxPrice} ETH)</h2>
                <button className="bg-green-600 text-white rounded p-2 mt-2" onClick={openMysteryBox}>
                    Buy & Open
                </button>
            </section>

            {/* list NFT */}
            <section className="border p-4 rounded">
                <h2 className="font-semibold">List NFT</h2>
                <input placeholder="Token ID"
                    value={tokenIdForSale}
                    onChange={e => setTokenIdForSale(e.target.value)}
                    className="border p-1 mr-2" />
                <input placeholder="Price (ETH)"
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    className="border p-1 mr-2" />
                <select value={saleType} onChange={e => setSaleType(e.target.value as any)}
                    className="border p-1 mr-2">
                    <option>FixedPrice</option><option>Auction</option>
                </select>
                {saleType === "Auction" &&
                    <input placeholder="End (unix time)"
                        value={auctionEndTime}
                        onChange={e => setAuctionEndTime(e.target.value)}
                        className="border p-1 mt-2" />}
                <button onClick={listNFT} className="bg-purple-600 text-white rounded p-2 mt-2">
                    List
                </button>
            </section>

            {/* buy / bid / finalize */}
            <section className="grid md:grid-cols-4 gap-4">
                <div className="border p-4 rounded">
                    <h3 className="font-semibold">Buy (Fixed)</h3>
                    <input placeholder="Token ID"
                        value={tokenIdToBuy}
                        onChange={e => setTokenIdToBuy(e.target.value)}
                        className="border p-1 mr-2" />
                    <input placeholder="Price ETH"
                        value={buyPrice}
                        onChange={e => setBuyPrice(e.target.value)}
                        className="border p-1" />
                    <button className="bg-blue-600 text-white rounded p-2 mt-2" onClick={buyNFT}>
                        Buy
                    </button>
                </div>
                <div className="border p-4 rounded">
                    <h3 className="font-semibold">Bid (Auction)</h3>
                    <input placeholder="Token ID"
                        value={tokenIdToBid}
                        onChange={e => setTokenIdToBid(e.target.value)}
                        className="border p-1 mr-2" />
                    <input placeholder="Bid ETH"
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        className="border p-1" />
                    <button className="bg-orange-600 text-white rounded p-2 mt-2" onClick={placeBid}>
                        Bid
                    </button>
                </div>
                <div className="border p-4 rounded">
                    <h3 className="font-semibold">Finalize Auction</h3>
                    <input placeholder="Token ID"
                        value={tokenIdToFin}
                        onChange={e => setTokenIdToFin(e.target.value)}
                        className="border p-1" />
                    <button className="bg-red-600 text-white rounded p-2 mt-2" onClick={finalizeAuction}>
                        Finalize
                    </button>
                </div>

                <div className="border p-4 rounded">
                    <h3 className="font-semibold">Cancel Listing</h3>

                    <input
                        placeholder="Token ID"
                        value={tokenIdToCancel}
                        onChange={e => setTokenIdToCancel(e.target.value)}
                        className="border p-1"
                    />

                    <button
                        className="bg-gray-600 text-white rounded p-2 mt-2"
                        onClick={() => cancelListing(tokenIdToCancel)}
                    >
                        Cancel
                    </button>
                </div>

            </section>

            {/* public listings */}
            <section className="border p-4 rounded">
                <h2 className="text-xl font-bold">🌍 Public Listings</h2>
                {listedTokens.length === 0
                    ? <p>No NFTs listed right now.</p>
                    : <div className="grid md:grid-cols-3 gap-4 mt-3">
                        {listedTokens.map((p, i) => (
                            <div key={i} className="border rounded shadow p-3">
                                <h3 className="font-bold">{p.name} #{p.tokenId}</h3>
                                <p>Type: {p.pokemonType}</p>
                                <p>Lvl {Number(p.level)} | HP {Number(p.hp)} | ATK {Number(p.attack)} | DEF {Number(p.defense)} | SPD {Number(p.speed)}</p>
                                <p>Gender: {p.gender}</p>
                                <p>Sp. Attack: {p.spAttack} | Sp. Defense: {p.spDefense}</p>
                                <p>Purity: {Number(p.purity)}</p>
                                <p className="mt-2">💰 {p.price} ETH ({p.saleType})</p>
                                {p.saleType === "Auction" && (
                                    <p>⏳ Ends in {formatCountdown(Math.floor(p.endTime - Date.now() / 1000))}</p>
                                )}

                                {p.seller === userAddress && (
                                    <button
                                        className="mt-2 bg-red-500 text-white px-2 py-1 rounded"
                                        onClick={() => cancelListing(p.tokenId)}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        ))}

                    </div>}
            </section>

            {/* owned pokémon */}
            <section className="border p-4 rounded">
                <h2 className="text-xl font-bold">🧬 My Pokémon</h2>
                {ownedTokens.length === 0
                    ? <p>You own none.</p>
                    : <div className="grid md:grid-cols-3 gap-4 mt-3">
                        {ownedTokens.map((p, i) => (
                            <div key={i} className="border rounded shadow p-3">
                                <h3 className="font-bold">{p.name} #{p.tokenId}</h3>
                                <p>Type: {p.pokemonType}</p>
                                <p>Lvl {Number(p.level)} | HP {Number(p.hp)} | ATK {Number(p.attack)} | DEF {Number(p.defense)} | SPD {Number(p.speed)}</p>
                                <p>Gender: {p.gender}</p>
                                <p>Sp. Attack: {p.spAttack} | Sp. Defense: {p.spDefense}</p>
                                <p>Purity: {Number(p.purity)}</p>
                            </div>
                        ))}
                    </div>}
            </section>

        </div>
    );
}
