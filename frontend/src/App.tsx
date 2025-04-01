import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

/**
 * Replace these with the actual ABIs from your Hardhat build artifacts.
 * For example, import them from /artifacts/contracts/PokemonNFT.sol/PokemonNFT.json if you're using Hardhat.
 */
import PokemonNFTArtifact from "./abis/PokemonNFT.json";
import TradingArtifact from "./abis/TradingWithAuctions.json";

const PokemonNFTAbi = PokemonNFTArtifact.abi;
const TradingAbi = TradingArtifact.abi;

/**
 * Replace these with the addresses from your Hardhat deploy output.
 * Example:
 * PokemonNFT deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
 */
const PokemonNFTAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TradingAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export default function CompleteFrontend() {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [userAddress, setUserAddress] = useState(null);

    // Contract instances
    const [pokemonNFTContract, setPokemonNFTContract] = useState(null);
    const [tradingContract, setTradingContract] = useState(null);

    // UI states
    const [boxPrice, setBoxPrice] = useState("");
    const [consoleLog, setConsoleLog] = useState("");

    // Auction / listing states
    const [tokenIdForSale, setTokenIdForSale] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [saleType, setSaleType] = useState("FixedPrice");
    const [auctionEndTime, setAuctionEndTime] = useState("");

    const [tokenIdToBuy, setTokenIdToBuy] = useState("");
    const [buyPrice, setBuyPrice] = useState("");

    const [tokenIdToBid, setTokenIdToBid] = useState("");
    const [bidAmount, setBidAmount] = useState("");

    const [tokenIdToFinalize, setTokenIdToFinalize] = useState("");

    // Admin minting info
    const [adminPokemon, setAdminPokemon] = useState({
        name: "Charizard",
        gender: "Male",
        pokemonType: "Fire",
        spAttack: "Flamethrower",
        spDefense: "Flame Shield",
        level: 36,
        hp: 120,
        attack: 140,
        defense: 90,
        speed: 100,
        purity: 255,
    });

    /**
     * 1. On component mount, try to set up ethers (if window.ethereum is present)
     */
    useEffect(() => {
        if (window.ethereum) {
            const tempProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(tempProvider);
        } else {
            console.log("Please install MetaMask!");
        }
    }, []);

    /**
     * 2. Once the contracts are set, listen for events
     */
    useEffect(() => {
        if (!pokemonNFTContract || !tradingContract) return;

        // Attach event listeners
        pokemonNFTContract.on("PokemonCardMinted", (owner, tokenId, name) => {
            setConsoleLog((prev) =>
                prev + `\nNew Pokemon Minted! Token ID: ${tokenId.toString()} - Owner: ${owner}`
            );
        });

        tradingContract.on("Listed", (nft, tokenId, seller, price, sType, endTime) => {
            setConsoleLog((prev) =>
                prev +
                `\nNFT Listed: Token #${tokenId.toString()} at ${ethers.formatEther(price)} ETH`
            );
        });

        tradingContract.on("Purchase", (nft, tokenId, buyer, price) => {
            setConsoleLog((prev) =>
                prev +
                `\nNFT Purchased! Token #${tokenId.toString()} by ${buyer} for ${ethers.formatEther(
                    price
                )} ETH`
            );
        });

        tradingContract.on("NewBid", (nft, tokenId, bidder, amount) => {
            setConsoleLog((prev) =>
                prev +
                `\nNew Bid: ${ethers.formatEther(amount)} ETH on Token #${tokenId.toString()} by ${bidder}`
            );
        });

        tradingContract.on("AuctionFinalized", (nft, tokenId, winner, finalPrice) => {
            if (winner === ethers.ZeroAddress) {
                setConsoleLog(
                    (prev) => prev + `\nAuction ended for Token #${tokenId.toString()}, but no bids.`
                );
            } else {
                setConsoleLog(
                    (prev) =>
                        prev +
                        `\nAuction Finalized! Token #${tokenId.toString()} won by ${winner} for ${ethers.formatEther(
                            finalPrice
                        )} ETH`
                );
            }
        });

        // Cleanup: remove listeners when unmounting or re-rendering
        return () => {
            pokemonNFTContract.removeAllListeners("PokemonCardMinted");
            tradingContract.removeAllListeners("Listed");
            tradingContract.removeAllListeners("Purchase");
            tradingContract.removeAllListeners("NewBid");
            tradingContract.removeAllListeners("AuctionFinalized");
        };
    }, [pokemonNFTContract, tradingContract]);

    /**
     * 3. Connect wallet + set up signer + instantiate contracts
     */
    const connectWallet = async () => {
        if (!provider) return;
        try {
            // Request accounts
            await provider.send("eth_requestAccounts", []);
            const tempSigner = await provider.getSigner();
            const address = await tempSigner.getAddress();
            setSigner(tempSigner);
            setUserAddress(address);
            setConsoleLog(`Connected as: ${address}`);

            // Instatiate the NFT contract
            const nftContract = new ethers.Contract(
                PokemonNFTAddress,
                PokemonNFTAbi,
                tempSigner
            );
            setPokemonNFTContract(nftContract);

            // Instantiate the Trading contract
            const tradeContract = new ethers.Contract(
                TradingAddress,
                TradingAbi,
                tempSigner
            );
            setTradingContract(tradeContract);

            // Read box price from NFT contract
            const price = await nftContract.boxPrice();
            setBoxPrice(ethers.formatEther(price));
        } catch (err) {
            console.error(err);
            setConsoleLog(`Error: ${err.message}`);
        }
    };

    /**
     * 4. Mystery Box Purchase
     */
    const openMysteryBox = async () => {
        if (!pokemonNFTContract || !signer) {
            setConsoleLog("Not connected.");
            return;
        }
        try {
            // Convert boxPrice to Wei
            const priceWei = ethers.parseEther(boxPrice);

            const tx = await pokemonNFTContract.openMysteryBox({
                value: priceWei,
            });
            await tx.wait();
            setConsoleLog("Mystery Box Opened! Check your wallet for the new NFT.");
        } catch (err) {
            console.error(err);
            setConsoleLog(err.message);
        }
    };

    /**
     * 5. Admin Mint (onlyOwner)
     */
    const adminMintPokemon = async () => {
        if (!pokemonNFTContract || !signer) {
            setConsoleLog("Not connected.");
            return;
        }
        try {
            const {
                name,
                gender,
                pokemonType,
                spAttack,
                spDefense,
                level,
                hp,
                attack,
                defense,
                speed,
                purity,
            } = adminPokemon;

            const tx = await pokemonNFTContract.mintRandomPokemon(
                name,
                gender,
                pokemonType,
                spAttack,
                spDefense,
                level,
                hp,
                attack,
                defense,
                speed,
                purity
            );
            await tx.wait();
            setConsoleLog("Admin minted a new Pokemon!");
        } catch (err) {
            console.error(err);
            setConsoleLog(err.message);
        }
    };

    /**
     * 6. List NFT (fixed or auction)
     */
    const listNFT = async () => {
        if (!tradingContract) return;

        try {
            // Convert saleType string to enum in your contract (0=FixedPrice, 1=Auction)
            let saleTypeEnum = 0; // default to 0 for FixedPrice
            if (saleType === "Auction") {
                saleTypeEnum = 1;
            }

            // parse salePrice to Wei
            const priceInWei = ethers.parseEther(salePrice);
            const endTimeUnix = auctionEndTime ? Number(auctionEndTime) : 0;

            const tx = await tradingContract.listItem(
                PokemonNFTAddress,
                tokenIdForSale,
                priceInWei,
                saleTypeEnum,
                endTimeUnix
            );
            await tx.wait();
            setConsoleLog("NFT Listed Successfully!");
        } catch (err) {
            setConsoleLog(err.message);
            console.error(err);
        }
    };

    /**
     * 7. Buy NFT (fixed price)
     */
    const buyNFT = async () => {
        if (!tradingContract) return;
        try {
            const priceWei = ethers.parseEther(buyPrice);
            const tx = await tradingContract.buyItem(PokemonNFTAddress, tokenIdToBuy, {
                value: priceWei,
            });
            await tx.wait();
            setConsoleLog(`Bought token #${tokenIdToBuy}`);
        } catch (err) {
            setConsoleLog(err.message);
            console.error(err);
        }
    };

    /**
     * 8. Place Bid (auction)
     */
    const placeBid = async () => {
        if (!tradingContract) return;
        try {
            const bidWei = ethers.parseEther(bidAmount);
            const tx = await tradingContract.placeBid(PokemonNFTAddress, tokenIdToBid, {
                value: bidWei,
            });
            await tx.wait();
            setConsoleLog("Bid placed successfully.");
        } catch (err) {
            setConsoleLog(err.message);
            console.error(err);
        }
    };

    /**
     * 9. Finalize Auction
     */
    const finalizeAuction = async () => {
        if (!tradingContract) return;
        try {
            const tx = await tradingContract.finalizeAuction(
                PokemonNFTAddress,
                tokenIdToFinalize
            );
            await tx.wait();
            setConsoleLog("Auction finalized!");
        } catch (err) {
            setConsoleLog(err.message);
            console.error(err);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold">Pokémon Marketplace</h1>

            {/* Connect Button */}
            {!userAddress && (
                <button
                    onClick={connectWallet}
                    className="p-2 bg-blue-500 text-white rounded mt-2"
                >
                    Connect MetaMask
                </button>
            )}
            <p>Connected as: {userAddress || "Not connected"}</p>

            {/* Mystery Box */}
            <div className="mt-4 border p-4">
                <h2 className="font-bold">Open Mystery Box</h2>
                <p>Box Price: {boxPrice} ETH</p>
                <button
                    onClick={openMysteryBox}
                    className="p-2 bg-green-500 text-white rounded"
                >
                    Buy Mystery Box
                </button>
            </div>

            {/* Admin Mint */}
            <div className="mt-4 border p-4">
                <h2 className="font-bold">Admin Mint (onlyOwner)</h2>
                <div className="flex flex-col space-y-2">
                    <label>
                        Name:
                        <input
                            type="text"
                            value={adminPokemon.name}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, name: e.target.value })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        Gender:
                        <input
                            type="text"
                            value={adminPokemon.gender}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, gender: e.target.value })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        PokemonType:
                        <input
                            type="text"
                            value={adminPokemon.pokemonType}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, pokemonType: e.target.value })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        spAttack:
                        <input
                            type="text"
                            value={adminPokemon.spAttack}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, spAttack: e.target.value })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        spDefense:
                        <input
                            type="text"
                            value={adminPokemon.spDefense}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, spDefense: e.target.value })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        Level:
                        <input
                            type="number"
                            value={adminPokemon.level}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, level: Number(e.target.value) })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        HP:
                        <input
                            type="number"
                            value={adminPokemon.hp}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, hp: Number(e.target.value) })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        Attack:
                        <input
                            type="number"
                            value={adminPokemon.attack}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, attack: Number(e.target.value) })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        Defense:
                        <input
                            type="number"
                            value={adminPokemon.defense}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, defense: Number(e.target.value) })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        Speed:
                        <input
                            type="number"
                            value={adminPokemon.speed}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, speed: Number(e.target.value) })
                            }
                            className="border ml-2"
                        />
                    </label>
                    <label>
                        Purity:
                        <input
                            type="number"
                            value={adminPokemon.purity}
                            onChange={(e) =>
                                setAdminPokemon({ ...adminPokemon, purity: Number(e.target.value) })
                            }
                            className="border ml-2"
                        />
                    </label>
                </div>
                <button
                    onClick={adminMintPokemon}
                    className="p-2 bg-blue-500 text-white rounded mt-2"
                >
                    Admin Mint
                </button>
            </div>

            {/* List NFT */}
            <div className="mt-4 border p-4">
                <h2 className="font-bold">List NFT (Fixed or Auction)</h2>
                <label>Token ID:</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={tokenIdForSale}
                    onChange={(e) => setTokenIdForSale(e.target.value)}
                />
                <label className="ml-2">Price (ETH):</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                />
                <div className="mt-2">
                    <select
                        value={saleType}
                        onChange={(e) => setSaleType(e.target.value)}
                        className="border"
                    >
                        <option value="FixedPrice">Fixed Price</option>
                        <option value="Auction">Auction</option>
                    </select>
                </div>
                {saleType === "Auction" && (
                    <div>
                        <label> End Time (Unix timestamp): </label>
                        <input
                            type="text"
                            value={auctionEndTime}
                            onChange={(e) => setAuctionEndTime(e.target.value)}
                            className="border ml-2"
                        />
                    </div>
                )}
                <button
                    onClick={listNFT}
                    className="p-2 bg-purple-500 text-white rounded mt-2"
                >
                    List NFT
                </button>
            </div>

            {/* Buy NFT */}
            <div className="mt-4 border p-4">
                <h2 className="font-bold">Buy NFT (Fixed Price)</h2>
                <label>Token ID:</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={tokenIdToBuy}
                    onChange={(e) => setTokenIdToBuy(e.target.value)}
                />
                <label className="ml-2">Price (ETH):</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                />
                <button
                    onClick={buyNFT}
                    className="p-2 bg-yellow-500 text-white rounded mt-2"
                >
                    Buy NFT
                </button>
            </div>

            {/* Place Bid */}
            <div className="mt-4 border p-4">
                <h2 className="font-bold">Place a Bid (Auction)</h2>
                <label>Token ID:</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={tokenIdToBid}
                    onChange={(e) => setTokenIdToBid(e.target.value)}
                />
                <label className="ml-2">Bid (ETH):</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                />
                <button
                    onClick={placeBid}
                    className="p-2 bg-red-500 text-white rounded mt-2"
                >
                    Place Bid
                </button>
            </div>

            {/* Finalize Auction */}
            <div className="mt-4 border p-4">
                <h2 className="font-bold">Finalize Auction</h2>
                <label>Token ID:</label>
                <input
                    type="text"
                    className="border ml-2"
                    value={tokenIdToFinalize}
                    onChange={(e) => setTokenIdToFinalize(e.target.value)}
                />
                <button
                    onClick={finalizeAuction}
                    className="p-2 bg-green-500 text-white rounded mt-2"
                >
                    Finalize
                </button>
            </div>

            {/* Console Output */}
            <div className="mt-4 p-4 bg-gray-100">
                <h2 className="font-bold">Console Log:</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{consoleLog}</p>
            </div>
        </div>
    );
}
