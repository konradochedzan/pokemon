// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
    const baseURI = "http://localhost:3001/metadata/";

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);

    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    const pokemonNFT = await PokemonNFT.deploy(baseURI);
    await pokemonNFT.waitForDeployment();
    console.log("PokemonNFT deployed to:", await pokemonNFT.getAddress());

    const Trading = await ethers.getContractFactory("TradingWithAuctions");
    const trading = await Trading.deploy();
    await trading.waitForDeployment();
    console.log("TradingWithAuctions deployed to:", await trading.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
