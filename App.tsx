import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

/*
 This is a complete React example showing how you might integrate the major features
discussed:

 1. Connect to MetaMask
 2. "Open Mystery Box" function on PokemonNFT (user pays boxPrice, gets a new NFT)
 3. Admin-only "mintRandomPokemon" function
 4. Listing an NFT (either fixed price or auction) on TradingWithAuctions
 5. Buying a fixed-price NFT
 6. Placing a bid / finalizing auctions

 This demo uses tailwind for styling, minimal though, as an example. 
 Adjust to your preferences.

 NOTE: You must have the addresses of the two contracts:
  - PokemonNFTAddress: The address of your deployed PokemonNFT contract
  - TradingAddress: The address of your deployed TradingWithAuctions contract

 Also note:
  - This code is for demonstration. In a real app, you might break it into multiple components.
  - You'll need the ABIs (JSON) for each contract. Below, we used placeholders for ABIs.

 STEPS:
 1. yarn add react ethers (and tailwind if desired)
 2. Replace the ABIs below with your actual contract ABIs.
 3. Replace PokemonNFTAddress and TradingAddress.
 4. Start your app.
*/

// Replace these ABIs with the actual compiled JSON from your Hardhat/artifacts!

const PokemonNFTAbi = [
    // ... put your PokemonNFT ABI here ...
];

const TradingAbi = [
    // ... put your TradingWithAuctions ABI here ...
];

// Replace with your actual deployed addresses
const PokemonNFTAddress = "0xYourPokemonNFTAddress";
const TradingAddress = "0xYourTradingWithAuctionsAddress";

export default function CompleteFrontend() {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [userAddress, setUserAddress] = useState(null);

    // Contract instances
    const [pokemonNFTContract, setPokemonNFTContract] = useState(null);
    const [tradingContract, setTradingContract] = useState(null);

    // UI states
    const [boxPrice, setBoxPrice] = useState("");
    const [newPokemonName, setNewPokemonName] = useState("Pikachu");
    const [consoleLog, setConsoleLog] = useState("");

    // Auction / listing states
    const [tokenIdForSale, setTokenIdForSale] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [saleType, setSaleType] = useState("FixedPrice");
    const [auctionEndTime, setAuctionEndTime] = useState("");

    const [tokenIdToBuy, setTokenIdToBuy] = useState("");
    const [buyPrice, setBuyPrice] = useState(""); // just for reference

    const [tokenIdToBid, setTokenIdToBid] = useState("");
    const [bidAmount, setBidAmount] = useState("");

    const [tokenIdToFinalize, setTokenIdToFinalize] = useState("");

    // For admin mint
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

    useEffect(() => {
        // On load, connect to metamask if available
        if (window.ethereum) {
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum);
            setProvider(tempProvider);
        } else {
            console.log("Please install MetaMask!");
        }
    }, []);

    const connectWallet = async () => {
        if (!provider) return;
        try {
            await provider.send("eth_requestAccounts", []);
            const tempSigner = provider.getSigner();
            const address = await tempSigner.getAddress();
            setSigner(tempSigner);
            setUserAddress(address);
            setConsoleLog(`Connected as: ${address}`);

            // Create contract instances
            const nftContract = new ethers.Contract(
                PokemonNFTAddress,
                PokemonNFTAbi,
                tempSigner
            );
            setPokemonNFTContract(nftContract);

            const tradeContract = new ethers.Contract(
                TradingAddress,
                TradingAbi,
                tempSigner
            );
            setTradingContract(tradeContract);

            // Optionally read the boxPrice from the contract
            const price = await nftContract.boxPrice();
            setBoxPrice(ethers.utils.formatEther(price.toString()));
        } catch (err) {
            console.error(err);
        }
    };

    // 1. OPEN MYSTERY BOX
    const openMysteryBox = async () => {
        if (!pokemonNFTContract || !signer) {
            setConsoleLog("Not connected.");
            return;
        }
        try {
            // parse boxPrice to BigNumber in WEI
            const priceWei = ethers.utils.parseEther(boxPrice);

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

    // 2. ADMIN MINT
    const adminMintPokemon = async () => {
        if (!pokemonNFTContract || !signer) {
            setConsoleLog("Not connected.");
            return;
        }
        try {
            // Convert numeric fields to numbers (especially if they are strings in state)
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

    // 3. LIST NFT (FixedPrice or Auction)
    const listNFT = async () => {
        if (!tradingContract) return;

        try {
            // saleType: "FixedPrice" => 0, "Auction" => 1 (depending on your enum logic)
            let saleTypeEnum = 0; // default to FixedPrice
            if (saleType === "Auction") {
                saleTypeEnum = 1;
            }
            // parse salePrice to Wei
            const priceInWei = ethers.utils.parseEther(salePrice);

            const endTimeUnix = auctionEndTime ? Number(auctionEndTime) : 0; // e.g. timestamp in seconds

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

    // 4. BUY NFT (Fixed Price)
    const buyNFT = async () => {
        if (!tradingContract) return;
        try {
            // parse buyPrice to Wei
            const priceWei = ethers.utils.parseEther(buyPrice);

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

    // 5. PLACE BID
    const placeBid = async () => {
        if (!tradingContract) return;
        try {
            const bidWei = ethers.utils.parseEther(bidAmount);
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

    // 6. FINALIZE AUCTION
    const finalizeAuction = async () => {
        if (!tradingContract) return;
        try {
            const tx = await tradingContract.finalizeAuction(PokemonNFTAddress, tokenIdToFinalize);
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

            {!userAddress && (
                <button
                    onClick={connectWallet}
                    className="p-2 bg-blue-500 text-white rounded mt-2"
                >
                    Connect MetaMask
                </button>
            )}

            <p>Connected as: {userAddress || "Not connected"}</p>
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

            <div className="mt-4 p-4 bg-gray-100">
                <h2 className="font-bold">Console Log:</h2>
                <p>{consoleLog}</p>
            </div>
        </div>
    );
}
