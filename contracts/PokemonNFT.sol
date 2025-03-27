// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol"; // NFT functionality like minting and transferring
import "@openzeppelin/contracts/access/Ownable.sol"; // Gives the owner mechanics 

/**
 * @title PokemonNFT
 * @dev ERC721 contract for minting Pokémon card NFTs
 */
contract PokemonNFT is ERC721, Ownable {
    // A simple struct for storing on-chain card characteristics
    struct PokemonAttributes {
        string name;
        string gender;
        string pokemonType;
        string spAttack; // special attack
        string spDefense; // special defense
        uint8 level; // we assume levels 1-100
        uint8 hp; // hp goes from 1 to 255
        uint16 attack;
        uint16 defense;
        uint16 speed;
    }

    // Store attributes in a mapping from tokenId -> PokemonAttributes
    mapping(uint256 => PokemonAttributes) private _tokenIdToAttributes;

    // Keep track of the next token ID to mint
    uint256 private _currentTokenId;

    // For front-end functionality we'll keep track of all the tokens
    uint256[] private _allTokenIds;

    // Base URI for metadata, if you plan to point to an off-chain JSON
    // If you want purely on-chain metadata, you can build the tokenURI directly
    string private _baseTokenURI;

    /**
     * @dev Emitted when a new Pokemon card is minted
     */

     // Whenever a Pokémon card is minted, I want to emit an event (notification) with the following data

    event PokemonCardMinted(
        address indexed owner,
        uint256 indexed tokenId,
        string name,
        string gender,
        string pokemonType,
        string spAttack,
        string spDefense,
        uint8 level,
        uint8 hp,
        uint16 attack,
        uint16 defense,
        uint16 speed
    );

    // This is a function that sets up the contracts setting when contract is deployed
    // the name of the collection is PokemonNFT and its symbol is PKMN

    constructor(string memory baseURI) ERC721("PokemonNFT", "PKMN") {
        _baseTokenURI = baseURI;
        // _currentTokenId starts at 0 by default; or set it to 1 if you prefer
    }

    /**
     * @dev Mint a new Pokémon card NFT with full attributes
     * @param recipient The address that will own the minted NFT
     * @param name The Pokémon's name (e.g., "Charizard")
     * @param gender The gender of the Pokémon (e.g., "Male", "Female", "None")
     * @param pokemonType The Pokémon's type (e.g., "Fire", "Water", "Grass")
     * @param spAttack The name of the Pokémon's special attack (e.g., "Flamethrower")
     * @param spDefense The name of the Pokémon's special defense (e.g., "Heat Shield")
     * @param level The Pokémon's level (range: 1–100)
     * @param hp The health points of the Pokémon
     * @param attack The base attack stat of the Pokémon
     * @param defense The base defense stat of the Pokémon
     * @param speed The base speed stat of the Pokémon
     */

uint256 public boxPrice = 0.01 ether;

// external function can be called from outside of the contract f.e. frontend

function mintRandomPokemon(
    string memory name,
    string memory gender,
    string memory pokemonType,
    string memory spAttack,
    string memory spDefense,
    uint8 level,
    uint8 hp,
    uint16 attack,
    uint16 defense,
    uint16 speed
) external payable {
    require(msg.value == boxPrice, "Incorrect payment");

    _currentTokenId++;
    uint256 newTokenId = _currentTokenId;

    _safeMint(msg.sender, newTokenId);// official ERC272 minting function giving ownership of NFT to *recipient*

    // This creates a new PokemonAttributes struct with the data the user gave and stores it in our mapping.

    _tokenIdToAttributes[newTokenId] = PokemonAttributes(
        name,
        gender,
        pokemonType,
        spAttack,
        spDefense,
        level,
        hp,
        attack,
        defense,
        speed
    );
    
    // Track all token IDs for frontend access

    _allTokenIds.push(newTokenId);

    // this emits an event to the blockchain

    emit PokemonCardMinted(
        msg.sender,
        newTokenId,
        name,
        gender,
        pokemonType,
        spAttack,
        spDefense,
        level,
        hp,
        attack,
        defense,
        speed
    );
}

 // function to withdraw money as a webpage owner

function withdraw() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
}

    /**
    * @dev Returns the attributes of a given Pokémon card
    * @param tokenId The token ID of the Pokémon card
    * @return A struct containing all Pokémon attributes (name, type, stats, etc.)
    */
     
    // *external* allows to run from outside the contract, *view* means it doesnt change the blockchain

    function getPokemonAttributes(uint256 tokenId)
        external
        view 
        returns (PokemonAttributes memory)
    {
        require(_exists(tokenId), "Token does not exist");
        return _tokenIdToAttributes[tokenId]; // this was the mapping that or an ID gives attributes assigned to it 
    }

    /**
     * @dev If you need a base URI for the off-chain metadata JSON
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Optionally set the base URI if you host JSON externally
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
}
