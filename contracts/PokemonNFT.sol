// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol"; // NFT functionality like minting and transferring
import "@openzeppelin/contracts/access/Ownable.sol"; // Gives the owner mechanics
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PokemonNFT
 * @dev ERC721 contract for minting Pokémon card NFTs
 */
contract PokemonNFT is ERC721, Ownable, ReentrancyGuard, Pausable {
    address public trustedSigner;

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setTrustedSigner(address _signer) external onlyOwner {
        trustedSigner = _signer;
    }

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
        uint8 purity; // on a scale 1-255 defines maximal potential of a given pokemon, should be assigned with a normal-ish distribution with mean 128
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

    uint256 public boxPrice = 0.01 ether;

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
        uint16 speed,
        uint8 purity
    );

    // This is a function that sets up the contracts setting when contract is deployed
    // the name of the collection is PokemonNFT and its symbol is PKMN

    constructor(string memory baseURI) ERC721("PokemonNFT", "PKMN") {
        _baseTokenURI = baseURI;
        // _currentTokenId starts at 0 by default; or set it to 1 if you prefer
    }

    /**
     * @dev Mint a new Pokémon card NFT with full attributes
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
     * @param purity The purity of a Pokemon, potential in training and affecting other stats
     */

    // external function can be called from outside of the contract f.e. frontend - this should be changed to minting only
    // for owner (us) as clients will be able to create new cards via openMysteryBox

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
        uint16 speed,
        uint8 purity
    ) external onlyOwner nonReentrant whenNotPaused {
        _currentTokenId++;
        uint256 newTokenId = _currentTokenId;

        _safeMint(msg.sender, newTokenId);

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
            speed,
            purity
        );

        _allTokenIds.push(newTokenId);

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
            speed,
            purity
        );
    }

    // open mystery box - function for users in front end to generate randomly the pokemon
    // variables for the mechanism preventing bot spam and infinite loops
    uint256 public lastMintBlock;
    uint256 public mintsThisBlock;

    function openMysteryBox(
        string memory name,
        string memory gender,
        string memory pokemonType,
        string memory spAttack,
        string memory spDefense,
        uint8 level,
        uint8 hp,
        uint16 attack,
        uint16 defense,
        uint16 speed,
        uint8 purity,
        bytes calldata signature
    ) external payable nonReentrant whenNotPaused {
        require(msg.value == boxPrice, "Incorrect payment");

        if (block.number == lastMintBlock) {
            mintsThisBlock++;
        } else {
            lastMintBlock = block.number;
            mintsThisBlock = 1;
        }

        if (mintsThisBlock > 20) {
            _pause();
        }

        // Prepare the message hash (must match what was signed off-chain)
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
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
            )
        );
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(
            messageHash
        );
        
        // Must match a trusted signer (your backend's wallet)

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == trustedSigner, "Invalid signature");

        // Mint the Pokémon
        _currentTokenId++;
        uint256 newTokenId = _currentTokenId;
        _safeMint(msg.sender, newTokenId);

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
            speed,
            purity
        );

        _allTokenIds.push(newTokenId);

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
            speed,
            purity
        );
    }

    // upgrade stats of your pokemon: here we would like to add a function allowing user to
    // train their pokemons. Bu paying a certain ammount the level of the pokemon increases,
    // what leads to increase of other stats like hp, attack and so on but the increase is dependent on
    // the 'purity' of each pokemon. We would like to assign some maximal values of attack, hp and so on
    // to max purity (f.e. on a scale 1-255) and say 50% of that maximal values to those of lowest purity.

    // function to withdraw money as a webpage owner

    function withdraw() external onlyOwner nonReentrant whenNotPaused {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev Returns the attributes of a given Pokémon card
     * @param tokenId The token ID of the Pokémon card
     * @return A struct containing all Pokémon attributes (name, type, stats, etc.)
     */

    // *external* allows to run from outside the contract, *view* means it doesnt change the blockchain

    function getPokemonAttributes(
        uint256 tokenId
    ) external view returns (PokemonAttributes memory) {
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
     * @dev At some point changing the metadata is locked so that the contract is more trustworthy
     */

    bool public metadataLocked;

    function lockMetadata() external onlyOwner {
        metadataLocked = true;
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        require(!metadataLocked, "Metadata is locked");
        _baseTokenURI = baseURI;
    }
}
