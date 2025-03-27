// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Trading is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    // Simple listing structure for fixed-price listings
    struct Listing {
        address seller;
        uint256 price;
    }

    // Mapping: NFT contract -> tokenId -> listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // Optional: track user’s listed tokenIds so you can retrieve them easily
    // e.g.: mapping(address => EnumerableSet.UintSet) private _sellerToListedTokenIds;

    // Events
    event Listed(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event Purchase(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );
    event Cancelled(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller
    );

    /**
     * @dev List an NFT on fixed-price sale
     */
    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external nonReentrant {
        require(price > 0, "Price must be > 0");
        require(
            IERC721(nftContract).ownerOf(tokenId) == msg.sender,
            "Not token owner"
        );
        require(
            IERC721(nftContract).getApproved(tokenId) == address(this) ||
                IERC721(nftContract).isApprovedForAll(
                    msg.sender,
                    address(this)
                ),
            "Trading contract not approved for transfer"
        );

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            price: price
        });

        emit Listed(nftContract, tokenId, msg.sender, price);
    }

    /**
     * @dev Buy an NFT that was listed at a fixed price
     */
    function buyItem(address nftContract, uint256 tokenId)
        external
        payable
        nonReentrant
    {
        Listing memory item = listings[nftContract][tokenId];
        require(item.price > 0, "Not listed for sale");
        require(msg.value == item.price, "Must pay exact price");

        // Remove from listings to avoid double buys
        delete listings[nftContract][tokenId];

        // Transfer payment to seller
        // (You might want to add a fee for the platform owner, e.g. a commission)
        payable(item.seller).transfer(item.price);

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(
            item.seller,
            msg.sender,
            tokenId
        );

        emit Purchase(nftContract, tokenId, msg.sender, item.price);
    }

    /**
     * @dev Cancel listing if you are the seller
     */
    function cancelListing(address nftContract, uint256 tokenId)
        external
        nonReentrant
    {
        Listing memory item = listings[nftContract][tokenId];
        require(item.price > 0, "Not listed");
        require(item.seller == msg.sender, "Not seller");

        delete listings[nftContract][tokenId];
        emit Cancelled(nftContract, tokenId, msg.sender);
    }

    // You can add an emergency stop (circuit breaker) pattern:
    bool public paused;

    modifier whenNotPaused() {
        require(!paused, "Trading paused");
        _;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // You can also add auction logic, commit-reveal patterns, etc.
}
