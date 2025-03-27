// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title TradingWithAuctions
 * @notice A marketplace contract that supports both fixed-price sales and simple English auctions.
 *         Sellers can choose which type of sale they'd like for each listing.
 *         Buyers can either instantly buy fixed-price items or place bids on auction listings.
 *         All logic (listing, buying, bidding, canceling, finalizing) is handled here.
 */
contract TradingWithAuctions is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @dev The type of sale for a particular listing.
     *      - FixedPrice: A normal listing with a set price that can be bought instantly.
     *      - Auction: An English auction with a start price, an end time, and a highest bidder.
     */
    enum SaleType {
        FixedPrice,
        Auction
    }

    /**
     * @dev This struct stores data for a single listing.
     *      If `saleType == SaleType.FixedPrice`, the `price` field is the fixed sale price.
     *      If `saleType == SaleType.Auction`, the `price` field is the starting bid.
     *      `endTime` is only used for auctions.
     *      `highestBid` and `highestBidder` track the leading bid.
     */
    struct Listing {
        address seller;           // Owner of the NFT
        SaleType saleType;        // FixedPrice or Auction
        uint256 price;           // For FixedPrice = sale price, for Auction = starting bid
        uint256 endTime;         // Auction only: time when auction ends
        address highestBidder;   // Auction only: current leading bidder
        uint256 highestBid;      // Auction only: current highest bid
    }

    // Mapping: NFT contract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // For convenience: track tokenIds each seller has listed
    mapping(address => EnumerableSet.UintSet) private _sellerToListedTokenIds;

    // Circuit breaker for emergency
    bool public paused;

    // Optional trading fee in basis points (e.g., 500 = 5%)
    uint256 public tradingFee = 0;

    // Events
    event Listed(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        SaleType saleType,
        uint256 endTime
    );

    event Purchase(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );

    event Cancelled(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller
    );

    event NewBid(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionFinalized(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed winner,
        uint256 finalPrice
    );

    /**
     * @dev Ensures the contract is not paused.
     */
    modifier whenNotPaused() {
        require(!paused, "Trading is paused");
        _;
    }

    /**
     * @notice Pause or unpause the contract.
     * @param _paused Pass true to pause, false to unpause.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @notice Sets the platform trading fee, in basis points.
     * @param fee The new fee. For example, 500 = 5%. Max allowed is 10%.
     */
    function setTradingFee(uint256 fee) external onlyOwner {
        require(fee <= 1000, "Max fee = 10%");
        tradingFee = fee;
    }

    /**
     * @notice Allows the contract owner to withdraw any accumulated fees.
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Lists an NFT for either fixed-price sale or auction.
     * @param nftContract The address of the ERC721 contract.
     * @param tokenId The tokenId of the NFT.
     * @param price For FixedPrice, the exact sale price. For Auction, the starting bid.
     * @param saleType Either SaleType.FixedPrice or SaleType.Auction.
     * @param endTime Only relevant if saleType == Auction; otherwise can be 0.
     */
    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        SaleType saleType,
        uint256 endTime
    )
        external
        whenNotPaused
        nonReentrant
    {
        require(price > 0, "Price must be > 0");
        require(
            IERC721(nftContract).ownerOf(tokenId) == msg.sender,
            "Not token owner"
        );
        require(
            IERC721(nftContract).getApproved(tokenId) == address(this) ||
            IERC721(nftContract).isApprovedForAll(msg.sender, address(this)),
            "Contract not approved"
        );

        // If it's an auction, ensure endTime is in the future
        if (saleType == SaleType.Auction) {
            require(endTime > block.timestamp, "Auction endTime invalid");
        }

        // Create the listing
        Listing memory newListing = Listing({
            seller: msg.sender,
            saleType: saleType,
            price: price,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0
        });

        listings[nftContract][tokenId] = newListing;
        _sellerToListedTokenIds[msg.sender].add(tokenId);

        emit Listed(nftContract, tokenId, msg.sender, price, saleType, endTime);
    }

    /**
     * @notice Buy a listed NFT if it's a FixedPrice sale. Pays the seller, transfers the NFT.
     * @param nftContract The address of the ERC721 contract.
     * @param tokenId The tokenId of the NFT.
     */
    function buyItem(address nftContract, uint256 tokenId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Listing storage item = listings[nftContract][tokenId];
        require(item.saleType == SaleType.FixedPrice, "Not a fixed price sale");
        require(item.price > 0, "Not listed");
        require(msg.value == item.price, "Incorrect payment");

        // Remove listing
        _sellerToListedTokenIds[item.seller].remove(tokenId);
        delete listings[nftContract][tokenId];

        // Calculate fee
        uint256 fee = (item.price * tradingFee) / 10000;
        uint256 sellerAmount = item.price - fee;

        // Pay seller + fee
        payable(item.seller).transfer(sellerAmount);
        if (fee > 0) {
            payable(owner()).transfer(fee);
        }

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(item.seller, msg.sender, tokenId);

        emit Purchase(nftContract, tokenId, msg.sender, item.price);
    }

    /**
     * @notice Cancel a listing (works for both fixed price and auction) if you are the seller.
     * @param nftContract The ERC721 contract.
     * @param tokenId The tokenId of the NFT.
     */
    function cancelListing(address nftContract, uint256 tokenId)
        external
        whenNotPaused
        nonReentrant
    {
        Listing memory item = listings[nftContract][tokenId];
        require(item.price > 0, "Not listed");
        require(item.seller == msg.sender, "Not seller");

        // For auctions, only allow cancel if there is no highest bid yet.
        if (item.saleType == SaleType.Auction) {
            require(item.highestBid == 0, "Already has a bid");
        }

        _sellerToListedTokenIds[msg.sender].remove(tokenId);
        delete listings[nftContract][tokenId];

        emit Cancelled(nftContract, tokenId, msg.sender);
    }

    /**
     * @notice Place a bid on an auction listing.
     * @param nftContract The ERC721 contract.
     * @param tokenId The tokenId of the NFT.
     */
    function placeBid(address nftContract, uint256 tokenId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Listing storage item = listings[nftContract][tokenId];
        require(item.saleType == SaleType.Auction, "Not an auction");
        require(block.timestamp < item.endTime, "Auction ended");
        require(msg.value > item.highestBid, "Bid too low");
        require(item.seller != address(0), "Not listed");

        // If there's an existing bidder, refund them
        if (item.highestBid > 0) {
            payable(item.highestBidder).transfer(item.highestBid);
        }

        // Record new highest bid
        item.highestBidder = msg.sender;
        item.highestBid = msg.value;

        emit NewBid(nftContract, tokenId, msg.sender, msg.value);
    }

    /**
     * @notice Finalize an auction if the end time has passed.
     *         If there's a highest bidder, transfer the NFT and pay the seller.
     *         If there was no bid, the seller keeps the NFT.
     * @param nftContract The ERC721 contract.
     * @param tokenId The tokenId of the NFT.
     */
    function finalizeAuction(address nftContract, uint256 tokenId)
        external
        whenNotPaused
        nonReentrant
    {
        Listing storage item = listings[nftContract][tokenId];
        require(item.saleType == SaleType.Auction, "Not an auction");
        require(block.timestamp >= item.endTime, "Auction not ended");
        require(item.seller != address(0), "Not listed");

        // Remove from active listings
        _sellerToListedTokenIds[item.seller].remove(tokenId);
        delete listings[nftContract][tokenId];

        // If no bids, do nothing except remove listing
        if (item.highestBid == 0) {
            // Seller keeps NFT, which they already hold since we never transferred it out.
            emit AuctionFinalized(nftContract, tokenId, address(0), 0);
            return;
        }

        // There's a winner. Pay the seller, transfer the NFT.
        uint256 fee = (item.highestBid * tradingFee) / 10000;
        uint256 sellerAmount = item.highestBid - fee;

        payable(item.seller).transfer(sellerAmount);
        if (fee > 0) {
            payable(owner()).transfer(fee);
        }

        // Transfer the NFT to the winner
        IERC721(nftContract).safeTransferFrom(item.seller, item.highestBidder, tokenId);

        emit AuctionFinalized(nftContract, tokenId, item.highestBidder, item.highestBid);
    }

    /**
     * @notice Get the tokenIds a user has currently listed (either fixed price or auction).
     * @param seller The address of the user.
     * @return An array of token IDs.
     */
    function getListedTokenIds(address seller) external view returns (uint256[] memory) {
        uint256 count = _sellerToListedTokenIds[seller].length();
        uint256[] memory tokens = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokens[i] = _sellerToListedTokenIds[seller].at(i);
        }
        return tokens;
    }
}