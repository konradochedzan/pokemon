import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { PokemonNFT, TradingWithAuctions } from "../typechain-types";

describe("PokemonNFT and Trading Tests", function () {
  // Define fixtures for PokemonNFT
  async function deployPokemonNFTFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const baseURI = "https://pokemon-api.com/metadata/";

    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    const pokemonNFT = await PokemonNFT.deploy(baseURI);

    return { pokemonNFT, baseURI, owner, user1, user2 };
  }

  // Define fixtures for TradingWithAuctions
  async function deployTradingWithAuctionsFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    const TradingWithAuctions = await ethers.getContractFactory("TradingWithAuctions");
    const tradingWithAuctions = await TradingWithAuctions.deploy();

    // Also deploy a Pokemon NFT for testing
    const baseURI = "https://pokemon-api.com/metadata/";
    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    const pokemonNFT = await PokemonNFT.deploy(baseURI);

    // Mint some Pokemon NFTs for testing
    await pokemonNFT.mintRandomPokemon(
      "Pikachu", "Male", "Electric", "Thunder Bolt", "Light Screen",
      10, 60, 55, 40, 90, 150
    );

    await pokemonNFT.mintRandomPokemon(
      "Charizard", "Male", "Fire", "Flamethrower", "Fire Shield",
      50, 120, 130, 100, 110, 200
    );

    // Transfer one to user1 for testing
    await pokemonNFT.transferFrom(owner.address, user1.address, 1);

    return { tradingWithAuctions, pokemonNFT, owner, user1, user2, user3 };
  }

  // --- PokemonNFT Tests ---
  describe("PokemonNFT", function () {
    describe("Deployment", function () {
      it("Should set the right owner", async function () {
        const { pokemonNFT, owner } = await loadFixture(deployPokemonNFTFixture);
        expect(await pokemonNFT.owner()).to.equal(owner.address);
      });

      it("Should have the correct name and symbol", async function () {
        const { pokemonNFT } = await loadFixture(deployPokemonNFTFixture);
        expect(await pokemonNFT.name()).to.equal("PokemonNFT");
        expect(await pokemonNFT.symbol()).to.equal("PKMN");
      });

      it("Should set the correct base URI", async function () {
        const { pokemonNFT, baseURI } = await loadFixture(deployPokemonNFTFixture);

        // Mint a token to test tokenURI
        await pokemonNFT.mintRandomPokemon(
          "Pikachu", "Male", "Electric", "Thunder Bolt", "Light Screen",
          10, 60, 55, 40, 90, 150
        );

        expect(await pokemonNFT.tokenURI(1)).to.equal(baseURI + "1");
      });
    });

    describe("Minting", function () {
      it("Should mint a new Pokemon NFT with correct attributes", async function () {
        const { pokemonNFT, owner } = await loadFixture(deployPokemonNFTFixture);

        await expect(pokemonNFT.mintRandomPokemon(
          "Pikachu", "Male", "Electric", "Thunder Bolt", "Light Screen",
          10, 60, 55, 40, 90, 150
        )).to.emit(pokemonNFT, "PokemonCardMinted")
          .withArgs(
            owner.address,
            1,
            "Pikachu",
            "Male",
            "Electric",
            "Thunder Bolt",
            "Light Screen",
            10,
            60,
            55,
            40,
            90,
            150
          );

        const attributes = await pokemonNFT.getPokemonAttributes(1);
        expect(attributes.name).to.equal("Pikachu");
        expect(attributes.gender).to.equal("Male");
        expect(attributes.pokemonType).to.equal("Electric");
        expect(attributes.level).to.equal(10);
        expect(attributes.hp).to.equal(60);
        expect(attributes.purity).to.equal(150);
      });

      it("Should only allow owner to mint using mintRandomPokemon", async function () {
        const { pokemonNFT, user1 } = await loadFixture(deployPokemonNFTFixture);

        await expect(pokemonNFT.connect(user1).mintRandomPokemon(
          "Pikachu", "Male", "Electric", "Thunder Bolt", "Light Screen",
          10, 60, 55, 40, 90, 150
        )).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Should correctly increment tokenId when minting multiple NFTs", async function () {
        const { pokemonNFT, owner } = await loadFixture(deployPokemonNFTFixture);

        await pokemonNFT.mintRandomPokemon(
          "Pikachu", "Male", "Electric", "Thunder Bolt", "Light Screen",
          10, 60, 55, 40, 90, 150
        );

        await expect(pokemonNFT.mintRandomPokemon(
          "Charizard", "Male", "Fire", "Flamethrower", "Fire Shield",
          50, 120, 130, 100, 110, 200
        )).to.emit(pokemonNFT, "PokemonCardMinted")
          .withArgs(
            owner.address,
            2, // Token ID should be 2
            "Charizard",
            "Male",
            "Fire",
            "Flamethrower",
            "Fire Shield",
            50,
            120,
            130,
            100,
            110,
            200
          );
      });
    });

    describe("Mystery Box", function () {
      it("Should allow users to open a mystery box with payment", async function () {
        const { pokemonNFT, user1, owner } = await loadFixture(deployPokemonNFTFixture);

        // Generate signature for mystery box
        // For testing purposes, we'll use a dummy signature
        // In a production environment, this would be generated off-chain

        // First create the domain separator params
        const domain = {
          name: "PokemonNFT",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pokemonNFT.getAddress()
        };

        // The types for EIP-712
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

        // The data to sign
        const value = {
          user: user1.address,
          name: "Bulbasaur",
          gender: "Male",
          pokemonType: "Grass",
          spAttack: "Vine Whip",
          spDefense: "Leech Seed",
          level: 5,
          hp: 45,
          attack: 49,
          defense: 49,
          speed: 45,
          purity: 100
        };

        // The hardhat signer as the trusted signer
        const trustedSigner = await ethers.getSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

        // Sign the data
        const signature = await trustedSigner.signTypedData(domain, types, value);

        // User opens a mystery box with payment
        await expect(pokemonNFT.connect(user1).openMysteryBox(
          "Bulbasaur", "Male", "Grass", "Vine Whip", "Leech Seed",
          5, 45, 49, 49, 45, 100,
          signature,
          { value: ethers.parseEther("0.01") }
        )).to.emit(pokemonNFT, "PokemonCardMinted")
          .withArgs(
            user1.address,
            1,
            "Bulbasaur",
            "Male",
            "Grass",
            "Vine Whip",
            "Leech Seed",
            5,
            45,
            49,
            49,
            45,
            100
          );

        // Check the attributes were set correctly
        const attributes = await pokemonNFT.getPokemonAttributes(1);
        expect(attributes.name).to.equal("Bulbasaur");
        expect(attributes.gender).to.equal("Male");
        expect(attributes.pokemonType).to.equal("Grass");
        expect(attributes.purity).to.equal(100);
      });

      it("Should fail if payment is incorrect", async function () {
        const { pokemonNFT, user1 } = await loadFixture(deployPokemonNFTFixture);

        const trustedSigner = await ethers.getSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
        const domain = {
          name: "PokemonNFT",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pokemonNFT.getAddress()
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
          user: user1.address,
          name: "Bulbasaur",
          gender: "Male",
          pokemonType: "Grass",
          spAttack: "Vine Whip",
          spDefense: "Leech Seed",
          level: 5,
          hp: 45,
          attack: 49,
          defense: 49,
          speed: 45,
          purity: 100
        };

        const signature = await trustedSigner.signTypedData(domain, types, value);

        // Attempt to open a mystery box with incorrect payment
        await expect(pokemonNFT.connect(user1).openMysteryBox(
          "Bulbasaur", "Male", "Grass", "Vine Whip", "Leech Seed",
          5, 45, 49, 49, 45, 100,
          signature,
          { value: ethers.parseEther("0.005") }
        )).to.be.revertedWith("Incorrect payment");
      });

      it("Should fail with invalid signature", async function () {
        const { pokemonNFT, user1, user2 } = await loadFixture(deployPokemonNFTFixture);

        // Using user2 to sign instead of trusted signer
        const domain = {
          name: "PokemonNFT",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pokemonNFT.getAddress()
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
          user: user1.address,
          name: "Bulbasaur",
          gender: "Male",
          pokemonType: "Grass",
          spAttack: "Vine Whip",
          spDefense: "Leech Seed",
          level: 5,
          hp: 45,
          attack: 49,
          defense: 49,
          speed: 45,
          purity: 100
        };

        // Using wrong signer
        const signature = await user2.signTypedData(domain, types, value);

        await expect(pokemonNFT.connect(user1).openMysteryBox(
          "Bulbasaur", "Male", "Grass", "Vine Whip", "Leech Seed",
          5, 45, 49, 49, 45, 100,
          signature,
          { value: ethers.parseEther("0.01") }
        )).to.be.revertedWith("Invalid signature");
      });
    });

    describe("Admin Functions", function () {
      it("Should allow owner to withdraw funds", async function () {
        const { pokemonNFT, user1, owner } = await loadFixture(deployPokemonNFTFixture);

        // First mint a pokemon through mystery box to generate funds
        const trustedSigner = await ethers.getSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
        const domain = {
          name: "PokemonNFT",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pokemonNFT.getAddress()
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
          user: user1.address,
          name: "Bulbasaur",
          gender: "Male",
          pokemonType: "Grass",
          spAttack: "Vine Whip",
          spDefense: "Leech Seed",
          level: 5,
          hp: 45,
          attack: 49,
          defense: 49,
          speed: 45,
          purity: 100
        };

        const signature = await trustedSigner.signTypedData(domain, types, value);

        await pokemonNFT.connect(user1).openMysteryBox(
          "Bulbasaur", "Male", "Grass", "Vine Whip", "Leech Seed",
          5, 45, 49, 49, 45, 100,
          signature,
          { value: ethers.parseEther("0.01") }
        );

        const initialBalance = await ethers.provider.getBalance(owner.address);

        // Withdraw funds
        await pokemonNFT.withdraw();

        const finalBalance = await ethers.provider.getBalance(owner.address);

        // Check that owner received the funds (accounting for gas)
        expect(finalBalance).to.be.gt(initialBalance);
      });

      it("Should allow owner to pause and unpause the contract", async function () {
        const { pokemonNFT, user1 } = await loadFixture(deployPokemonNFTFixture);

        // Pause the contract
        await pokemonNFT.pause();

        // Generate signature for mystery box
        const trustedSigner = await ethers.getSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
        const domain = {
          name: "PokemonNFT",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pokemonNFT.getAddress()
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
          user: user1.address,
          name: "Bulbasaur",
          gender: "Male",
          pokemonType: "Grass",
          spAttack: "Vine Whip",
          spDefense: "Leech Seed",
          level: 5,
          hp: 45,
          attack: 49,
          defense: 49,
          speed: 45,
          purity: 100
        };

        const signature = await trustedSigner.signTypedData(domain, types, value);

        // Try to open a mystery box while paused
        await expect(pokemonNFT.connect(user1).openMysteryBox(
          "Bulbasaur", "Male", "Grass", "Vine Whip", "Leech Seed",
          5, 45, 49, 49, 45, 100,
          signature,
          { value: ethers.parseEther("0.01") }
        )).to.be.revertedWith("Pausable: paused");

        // Unpause the contract
        await pokemonNFT.unpause();

        // Now should work
        await expect(pokemonNFT.connect(user1).openMysteryBox(
          "Bulbasaur", "Male", "Grass", "Vine Whip", "Leech Seed",
          5, 45, 49, 49, 45, 100,
          signature,
          { value: ethers.parseEther("0.01") }
        )).not.to.be.reverted;
      });

      it("Should allow owner to lock metadata", async function () {
        const { pokemonNFT, baseURI } = await loadFixture(deployPokemonNFTFixture);

        // Set new base URI
        const newBaseURI = "https://new-pokemon-api.com/metadata/";
        await pokemonNFT.setBaseURI(newBaseURI);

        // Mint a token to test tokenURI
        await pokemonNFT.mintRandomPokemon(
          "Pikachu", "Male", "Electric", "Thunder Bolt", "Light Screen",
          10, 60, 55, 40, 90, 150
        );

        expect(await pokemonNFT.tokenURI(1)).to.equal(newBaseURI + "1");

        // Lock metadata
        await pokemonNFT.lockMetadata();

        // Try to change base URI again
        await expect(pokemonNFT.setBaseURI("https://another-uri.com/")).to.be.revertedWith("Metadata is locked");
      });
    });
  });

  // --- TradingWithAuctions Tests ---
  describe("TradingWithAuctions", function () {
    describe("Deployment", function () {
      it("Should set the right owner", async function () {
        const { tradingWithAuctions, owner } = await loadFixture(deployTradingWithAuctionsFixture);
        expect(await tradingWithAuctions.owner()).to.equal(owner.address);
      });

      it("Should initialize with correct default values", async function () {
        const { tradingWithAuctions } = await loadFixture(deployTradingWithAuctionsFixture);
        expect(await tradingWithAuctions.paused()).to.equal(false);
        expect(await tradingWithAuctions.tradingFee()).to.equal(0);
      });
    });

    describe("Admin Functions", function () {
      it("Should allow owner to set trading fee", async function () {
        const { tradingWithAuctions } = await loadFixture(deployTradingWithAuctionsFixture);

        await tradingWithAuctions.setTradingFee(500); // 5%
        expect(await tradingWithAuctions.tradingFee()).to.equal(500);
      });

      it("Should not allow setting trading fee above 10%", async function () {
        const { tradingWithAuctions } = await loadFixture(deployTradingWithAuctionsFixture);

        await expect(tradingWithAuctions.setTradingFee(1100)).to.be.revertedWith("Max 10%");
      });

      it("Should allow owner to blacklist addresses", async function () {
        const { tradingWithAuctions, user1 } = await loadFixture(deployTradingWithAuctionsFixture);

        await tradingWithAuctions.setBlacklist(user1.address, true);
        expect(await tradingWithAuctions.isBlacklisted(user1.address)).to.equal(true);
      });

      it("Should allow owner to pause trading", async function () {
        const { tradingWithAuctions } = await loadFixture(deployTradingWithAuctionsFixture);

        await tradingWithAuctions.setPaused(true);
        expect(await tradingWithAuctions.paused()).to.equal(true);
      });
    });

    describe("Fixed Price Listings", function () {
      it("Should allow users to list NFTs for fixed price", async function () {
        const { tradingWithAuctions, pokemonNFT, user1 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // List the NFT
        const price = ethers.parseEther("0.5");
        await expect(tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          price,
          0, // SaleType.FixedPrice
          0 // No end time for fixed price
        )).to.emit(tradingWithAuctions, "Listed")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user1.address,
            price,
            0,
            0
          );

        // Check the listing was created correctly
        const listing = await tradingWithAuctions.listings(await pokemonNFT.getAddress(), 1);
        expect(listing.seller).to.equal(user1.address);
        expect(listing.price).to.equal(price);
        expect(listing.saleType).to.equal(0); // FixedPrice

        // Check token ownership was transferred to the contract
        expect(await pokemonNFT.ownerOf(1)).to.equal(await tradingWithAuctions.getAddress());
      });

      it("Should allow users to buy fixed price listings", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // List the NFT
        const price = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          price,
          0, // SaleType.FixedPrice
          0 // No end time for fixed price
        );
        const expectedPrice = price;
        // User2 buys the NFT
        await expect(tradingWithAuctions.connect(user2).buyItem(
          await pokemonNFT.getAddress(),
          1,
          { value: price }
        )).to.emit(tradingWithAuctions, "Purchase")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user2.address,
            expectedPrice
          );

        // Check the NFT was transferred to the buyer
        expect(await pokemonNFT.ownerOf(1)).to.equal(user2.address);
      });

      it("Should allow sellers to cancel their listings", async function () {
        const { tradingWithAuctions, pokemonNFT, user1 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // List the NFT
        const price = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          price,
          0, // SaleType.FixedPrice
          0 // No end time for fixed price
        );

        // Cancel the listing
        await expect(tradingWithAuctions.connect(user1).cancelListing(
          await pokemonNFT.getAddress(),
          1
        )).to.emit(tradingWithAuctions, "Cancelled")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user1.address
          );

        // Check the NFT was returned to the seller
        expect(await pokemonNFT.ownerOf(1)).to.equal(user1.address);
      });
    });

    describe("Auction Listings", function () {
      it("Should allow users to list NFTs for auction", async function () {
        const { tradingWithAuctions, pokemonNFT, user1 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // Get future timestamp for auction end
        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 60 * 60 * 24; // 1 day from now

        // List the NFT as an auction
        const startingBid = ethers.parseEther("0.5");
        await expect(tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          startingBid,
          1, // SaleType.Auction
          auctionEndTime
        )).to.emit(tradingWithAuctions, "Listed")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user1.address,
            startingBid,
            1,
            auctionEndTime
          );

        // Check the listing was created correctly
        const listing = await tradingWithAuctions.listings(await pokemonNFT.getAddress(), 1);
        expect(listing.seller).to.equal(user1.address);
        expect(listing.price).to.equal(startingBid);
        expect(listing.saleType).to.equal(1); // Auction
        expect(listing.endTime).to.equal(auctionEndTime);
      });

      it("Should allow users to place bids on auctions", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2, user3 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // Get future timestamp for auction end
        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 60 * 60 * 24; // 1 day from now

        // List the NFT as an auction
        const startingBid = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          startingBid,
          1, // SaleType.Auction
          auctionEndTime
        );

        // User2 places a bid
        const firstBid = ethers.parseEther("0.6");
        await expect(tradingWithAuctions.connect(user2).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: firstBid }
        )).to.emit(tradingWithAuctions, "NewBid")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user2.address,
            firstBid
          );

        // User3 places a higher bid
        const secondBid = ethers.parseEther("0.7");
        await expect(tradingWithAuctions.connect(user3).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: secondBid }
        )).to.emit(tradingWithAuctions, "NewBid")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user3.address,
            secondBid
          );

        // Check that the auction data was updated
        const listing = await tradingWithAuctions.listings(await pokemonNFT.getAddress(), 1);
        expect(listing.highestBidder).to.equal(user3.address);
        expect(listing.highestBid).to.equal(secondBid);
      });

      it("Should reject bids lower than the current highest bid", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2, user3 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // Get future timestamp for auction end
        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 60 * 60 * 24; // 1 day from now

        // List the NFT as an auction
        const startingBid = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          startingBid,
          1, // SaleType.Auction
          auctionEndTime
        );

        // User2 places a bid
        const firstBid = ethers.parseEther("0.6");
        await tradingWithAuctions.connect(user2).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: firstBid }
        );

        // User3 tries to place a lower bid
        const lowerBid = ethers.parseEther("0.55");
        await expect(tradingWithAuctions.connect(user3).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: lowerBid }
        )).to.be.revertedWith("Bid too low");
      });

      it("Should reject bids after auction end time", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // Get future timestamp for auction end (short duration for test)
        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 100; // Just 100 seconds

        // List the NFT as an auction
        const startingBid = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          startingBid,
          1, // SaleType.Auction
          auctionEndTime
        );

        // Fast forward time to after auction end
        await time.increaseTo(auctionEndTime + 1);

        // User2 tries to place a bid after auction end
        const bid = ethers.parseEther("0.6");
        await expect(tradingWithAuctions.connect(user2).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: bid }
        )).to.be.revertedWith("Auction ended");
      });

      it("Should allow finalizing auction with a winner", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // Get future timestamp for auction end
        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 100; // Short duration for testing

        // List the NFT as an auction
        const startingBid = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          startingBid,
          1, // SaleType.Auction
          auctionEndTime
        );

        // User2 places a bid
        const bidAmount = ethers.parseEther("0.6");
        await tradingWithAuctions.connect(user2).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: bidAmount }
        );

        // Fast forward time to after auction end
        await time.increaseTo(auctionEndTime + 1);

        // Get initial balances
        const initialSellerBalance = await ethers.provider.getBalance(user1.address);

        // Finalize the auction
        await expect(tradingWithAuctions.finalizeAuction(
          await pokemonNFT.getAddress(),
          1
        )).to.emit(tradingWithAuctions, "AuctionFinalized")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            user2.address,
            bidAmount
          );

        // Check NFT was transferred to the winner
        expect(await pokemonNFT.ownerOf(1)).to.equal(user2.address);

        // Check seller received the funds
        const finalSellerBalance = await ethers.provider.getBalance(user1.address);
        expect(finalSellerBalance).to.be.gt(initialSellerBalance);
      });

      it("Should allow finalizing auction with no bids", async function () {
        const { tradingWithAuctions, pokemonNFT, user1 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Approve trading contract
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        // Get future timestamp for auction end
        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 100; // Short duration for testing

        // List the NFT as an auction
        const startingBid = ethers.parseEther("0.5");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          startingBid,
          1, // SaleType.Auction
          auctionEndTime
        );

        // Fast forward time to after auction end
        await time.increaseTo(auctionEndTime + 1);

        // Finalize the auction with no bids
        await expect(tradingWithAuctions.finalizeAuction(
          await pokemonNFT.getAddress(),
          1
        )).to.emit(tradingWithAuctions, "AuctionFinalized")
          .withArgs(
            await pokemonNFT.getAddress(),
            1,
            ethers.ZeroAddress,
            0
          );

        // Check NFT was returned to the seller
        expect(await pokemonNFT.ownerOf(1)).to.equal(user1.address);
      });
    });

    describe("View Functions", function () {
      it("Should correctly return listed token IDs for a seller", async function () {
        const { tradingWithAuctions, pokemonNFT, owner, user1 } = await loadFixture(deployTradingWithAuctionsFixture);

        // First mint another token to test with
        await pokemonNFT.mintRandomPokemon(
          "Blastoise", "Male", "Water", "Hydro Pump", "Water Shield",
          40, 100, 95, 120, 80, 180
        );

        // Transfer to user1
        await pokemonNFT.transferFrom(owner.address, user1.address, 2);

        // Approve trading contract for both tokens
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 2);

        // List both tokens
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          ethers.parseEther("0.5"),
          0, // FixedPrice
          0
        );

        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          2,
          ethers.parseEther("0.7"),
          0, // FixedPrice
          0
        );

        // Check getListedTokenIds returns both tokens
        const listedTokens = await tradingWithAuctions.getListedTokenIds(user1.address);
        expect(listedTokens.length).to.equal(2);
        expect(listedTokens.includes(BigInt(1))).to.be.true;
        expect(listedTokens.includes(BigInt(2))).to.be.true;
      });

      it("Should correctly return all listed tokens for an NFT contract", async function () {
        const { tradingWithAuctions, pokemonNFT, owner, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // First mint another token to test with
        await pokemonNFT.mintRandomPokemon(
          "Blastoise", "Male", "Water", "Hydro Pump", "Water Shield",
          40, 100, 95, 120, 80, 180
        );

        // Transfer tokens to users
        // Make sure owner actually owns token 1 before transferring
        const token1Owner = await pokemonNFT.ownerOf(2);
        if (token1Owner === owner.address) {
          await pokemonNFT.transferFrom(owner.address, user1.address, 2);
        } else {
          console.log("Note: Owner doesn't own token 1, skipping transfer");
        }

        // Transfer token 2 - this should be fine as it was just minted to owner
        await pokemonNFT.transferFrom(owner.address, user2.address, 3);

        // Get current owners of tokens to make sure we approve correctly
        const currentOwner1 = await pokemonNFT.ownerOf(2);
        const currentOwner2 = await pokemonNFT.ownerOf(3);

        // Approve trading contract with the correct owners
        await pokemonNFT.connect(await ethers.getSigner(currentOwner1)).approve(await tradingWithAuctions.getAddress(), 2);
        await pokemonNFT.connect(await ethers.getSigner(currentOwner2)).approve(await tradingWithAuctions.getAddress(), 3);

        // List tokens from correct owners
        await tradingWithAuctions.connect(await ethers.getSigner(currentOwner1)).listItem(
          await pokemonNFT.getAddress(),
          2,
          ethers.parseEther("0.5"),
          0, // FixedPrice
          0
        );

        await tradingWithAuctions.connect(await ethers.getSigner(currentOwner2)).listItem(
          await pokemonNFT.getAddress(),
          3,
          ethers.parseEther("0.7"),
          0, // FixedPrice
          0
        );

        // Check getAllListedTokenIds
        const allListedTokens = await tradingWithAuctions.getAllListedTokenIds(await pokemonNFT.getAddress());
        expect(allListedTokens.length).to.equal(2);
        expect(allListedTokens.includes(BigInt(2))).to.be.true;
        expect(allListedTokens.includes(BigInt(3))).to.be.true;
      });
    });

    describe("Integration Tests", function () {
      it("Should handle the complete lifecycle of minting, listing, and buying", async function () {
        const { tradingWithAuctions, pokemonNFT, owner, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // 1. Owner mints a new Pokémon
        await pokemonNFT.mintRandomPokemon(
          "Mewtwo", "None", "Psychic", "Psychic", "Barrier",
          70, 150, 140, 125, 130, 255
        );

        // 2. Owner transfers to user1
        await pokemonNFT.transferFrom(owner.address, user1.address, 3);

        // 3. User1 approves and lists on marketplace
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 3);
        const listPrice = ethers.parseEther("2.0");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          3,
          listPrice,
          0, // FixedPrice
          0
        );

        // Verify it's listed correctly
        const listing = await tradingWithAuctions.listings(await pokemonNFT.getAddress(), 3);
        expect(listing.seller).to.equal(user1.address);
        expect(listing.price).to.equal(listPrice);

        // 4. User2 buys the NFT
        const initialUser1Balance = await ethers.provider.getBalance(user1.address);
        await tradingWithAuctions.connect(user2).buyItem(
          await pokemonNFT.getAddress(),
          3,
          { value: listPrice }
        );

        // 5. Verify ownership and balances
        expect(await pokemonNFT.ownerOf(3)).to.equal(user2.address);
        const finalUser1Balance = await ethers.provider.getBalance(user1.address);
        expect(finalUser1Balance).to.be.at.least(initialUser1Balance);

        // 6. Verify attributes are preserved through the whole process
        const attributes = await pokemonNFT.getPokemonAttributes(3);
        expect(attributes.name).to.equal("Mewtwo");
        expect(attributes.pokemonType).to.equal("Psychic");
        expect(attributes.purity).to.equal(255);
      });

      it("Should handle the complete lifecycle of minting, auction, and finalization", async function () {
        const { tradingWithAuctions, pokemonNFT, owner, user1, user2, user3 } = await loadFixture(deployTradingWithAuctionsFixture);

        // 1. Owner mints a new rare Pokémon
        await pokemonNFT.mintRandomPokemon(
          "Mew", "None", "Psychic", "Ancient Power", "Protect",
          100, 190, 180, 180, 170, 255
        );

        // 2. Owner transfers to user1
        await pokemonNFT.transferFrom(owner.address, user1.address, 3);

        // 3. User1 approves and lists as auction
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 3);

        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 500; // Short auction for testing

        const startingBid = ethers.parseEther("1.0");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          3,
          startingBid,
          1, // Auction
          auctionEndTime
        );

        // 4. User2 places first bid
        const firstBid = ethers.parseEther("1.2");
        await tradingWithAuctions.connect(user2).placeBid(
          await pokemonNFT.getAddress(),
          3,
          { value: firstBid }
        );

        // 5. User3 outbids
        const secondBid = ethers.parseEther("1.5");
        await tradingWithAuctions.connect(user3).placeBid(
          await pokemonNFT.getAddress(),
          3,
          { value: secondBid }
        );

        // 6. Move time forward past the end of auction
        await time.increaseTo(auctionEndTime + 1);

        // 7. Finalize auction
        const initialUser1Balance = await ethers.provider.getBalance(user1.address);
        await tradingWithAuctions.finalizeAuction(
          await pokemonNFT.getAddress(),
          3
        );

        // 8. Verify outcomes
        expect(await pokemonNFT.ownerOf(3)).to.equal(user3.address); // Winner gets NFT
        const finalUser1Balance = await ethers.provider.getBalance(user1.address);
        expect(finalUser1Balance).to.be.gt(initialUser1Balance); // Seller got paid

        // 9. Verify NFT attributes are preserved
        const attributes = await pokemonNFT.getPokemonAttributes(3);
        expect(attributes.name).to.equal("Mew");
        expect(attributes.level).to.equal(100);
        expect(attributes.purity).to.equal(255);
      });
    });

    describe("Edge Cases and Security", function () {
      it("Should prevent auction cancellation after bids are placed", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Setup auction
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        const currentTime = await time.latest();
        const auctionEndTime = currentTime + 60 * 60 * 24;

        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          ethers.parseEther("0.5"),
          1, // Auction
          auctionEndTime
        );

        // User2 places a bid
        await tradingWithAuctions.connect(user2).placeBid(
          await pokemonNFT.getAddress(),
          1,
          { value: ethers.parseEther("0.6") }
        );

        // User1 tries to cancel but should fail
        await expect(tradingWithAuctions.connect(user1).cancelListing(
          await pokemonNFT.getAddress(),
          1
        )).to.be.revertedWith("Bid exists");
      });

      it("Should enforce maximum price limits", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Try to list with price > MAX_PRICE
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        const tooHighPrice = ethers.parseEther("101"); // Contract MAX_PRICE is 100 ETH
        await expect(tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          tooHighPrice,
          0, // Fixed price
          0
        )).to.be.revertedWith("Price invalid");
      });

      it("Should handle blacklisted users correctly", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // Blacklist user1
        await tradingWithAuctions.setBlacklist(user1.address, true);

        // User1 tries to list an NFT
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);

        await expect(tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          ethers.parseEther("0.5"),
          0,
          0
        )).to.be.revertedWith("Blacklisted");

        // User2 lists an NFT (not blacklisted)
        await pokemonNFT.mintRandomPokemon(
          "Raichu", "Male", "Electric", "Thunderbolt", "Light Screen",
          30, 80, 75, 60, 110, 170
        );
        await pokemonNFT.transferFrom(await pokemonNFT.owner(), user2.address, 3);
        await pokemonNFT.connect(user2).approve(await tradingWithAuctions.getAddress(), 3);

        await tradingWithAuctions.connect(user2).listItem(
          await pokemonNFT.getAddress(),
          3,
          ethers.parseEther("0.5"),
          0,
          0
        );

        // Blacklisted user tries to buy
        await expect(tradingWithAuctions.connect(user1).buyItem(
          await pokemonNFT.getAddress(),
          3,
          { value: ethers.parseEther("0.5") }
        )).to.be.revertedWith("Blacklisted");
      });

      it("Should reject trading when contract is paused", async function () {
        const { tradingWithAuctions, pokemonNFT, user1, user2 } = await loadFixture(deployTradingWithAuctionsFixture);

        // List NFT
        await pokemonNFT.connect(user1).approve(await tradingWithAuctions.getAddress(), 1);
        const listPrice = ethers.parseEther("1.0");
        await tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          listPrice,
          0, // Fixed price
          0
        );

        // Pause the contract
        await tradingWithAuctions.setPaused(true);

        // Try to buy - should fail
        await expect(tradingWithAuctions.connect(user2).buyItem(
          await pokemonNFT.getAddress(),
          1,
          { value: listPrice }
        )).to.be.revertedWith("Trading paused");

        // Try to list - should fail
        await expect(tradingWithAuctions.connect(user1).listItem(
          await pokemonNFT.getAddress(),
          1,
          listPrice,
          0,
          0
        )).to.be.revertedWith("Trading paused");

        // Unpause and try again - should work
        await tradingWithAuctions.setPaused(false);
        await expect(tradingWithAuctions.connect(user2).buyItem(
          await pokemonNFT.getAddress(),
          1,
          { value: listPrice }
        )).not.to.be.reverted;
      });
    });
  });
});