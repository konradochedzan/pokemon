const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
const pokemonData = require("./pokemonData");

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const signer = new ethers.Wallet(PRIVATE_KEY);

const POKEMON_NFT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CHAIN_ID = 31337;

const app = express();
app.use(cors());
app.use(express.json());

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeStat(base, purity, level) {
    const scale = 0.5 + 0.5 * (purity / 255) * (level / 100);
    return Math.round(base * scale);
}

app.post("/sign", async (req, res) => {
    const userAddress = req.body.userAddress;

    const pokemonNames = Object.keys(pokemonData);
    const name = pokemonNames[Math.floor(Math.random() * pokemonNames.length)];
    const gender = Math.random() > 0.5 ? "Male" : "Female";
    const pkm = pokemonData[name];

    const pokemonType = pkm.type;
    const spAttack = pkm.spMoves.attack[Math.floor(Math.random() * pkm.spMoves.attack.length)];
    const spDefense = pkm.spMoves.defense[Math.floor(Math.random() * pkm.spMoves.defense.length)];

    const level = getRandomInt(1, 100);
    const purity = getRandomInt(1, 255);

    const hp = computeStat(pkm.baseStats.hp, purity, level);
    const attack = computeStat(pkm.baseStats.attack, purity, level);
    const defense = computeStat(pkm.baseStats.defense, purity, level);
    const speed = computeStat(pkm.baseStats.speed, purity, level);

    const domain = {
        name: "PokemonNFT",
        version: "1",
        chainId: CHAIN_ID,
        verifyingContract: POKEMON_NFT
    };

    const types = {
        PokemonMint: [
            { name: "user", type: "address" },
            { name: "name", type: "string" },
            { name: "gender", type: "string" },
            { name: "pokemonType", type: "string" },
            { name: "spAttack", type: "string" },
            { name: "spDefense", type: "string" },
            { name: "level", type: "uint8" },
            { name: "hp", type: "uint8" },
            { name: "attack", type: "uint16" },
            { name: "defense", type: "uint16" },
            { name: "speed", type: "uint16" },
            { name: "purity", type: "uint8" }
        ]
    };

    const value = {
        user: userAddress,
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
    };

    const signature = await signer.signTypedData(domain, types, value);

    res.json({
        signature,
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
    });
});

app.listen(3001, () => {
    console.log("🧙 Signature server running at http://localhost:3001");
});
