// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title TradingWithAuctions (escrow version)
 * @notice Marketplace that escrows listed NFTs (sent to this contract)
 *         Supports both fixed-price sales and simple English auctions.
 */
contract TradingWithAuctions is Ownable, ReentrancyGuard, ERC721Holder {
    using EnumerableSet for EnumerableSet.UintSet;

    // ─── Storage ────────────────────────────────────────────────────────────────

    // nft => listed tokenIds
    mapping(address => uint256[]) public listedTokenIds;
    address[] public listedNFTContracts;

    // nft => tokenId => listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // seller => tokenIds he/she listed
    mapping(address => EnumerableSet.UintSet) private _sellerToListedTokenIds;

    // blacklist, pause, fees
    mapping(address => bool) public isBlacklisted;
    bool public paused;
    uint256 public tradingFee = 0; // basis-points (e.g. 500 = 5 %)
    address public feeRecipient;
    uint256 public constant MAX_PRICE = 100 ether;

    // ─── Enums / Structs ────────────────────────────────────────────────────────

    enum SaleType {
        FixedPrice,
        Auction
    }

    struct Listing {
        address seller;
        SaleType saleType;
        uint256 price; // fixed price OR starting bid
        uint256 endTime; // auctions
        address highestBidder; // auctions
        uint256 highestBid; // auctions
    }

    // ─── Events ────────────────────────────────────────────────────────────────

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
    event FeeRecipientChanged(
        address indexed oldRecipient,
        address indexed newRecipient
    );
    // ─── Modifiers ──────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        require(!paused, "Trading paused");
        _;
    }
    modifier notBlacklisted() {
        require(!isBlacklisted[msg.sender], "Blacklisted");
        _;
    }

    // -----------------
    /// @notice initialise feeRecipient to the deployer
    constructor() {
        feeRecipient = msg.sender;
    }

    // ─── Admin setters ─────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function setBlacklist(address user, bool value) external onlyOwner {
        isBlacklisted[user] = value;
    }

    function setTradingFee(uint256 fee) external onlyOwner {
        require(fee <= 1000, "Max 10%");
        tradingFee = fee;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Zero recipient");
        emit FeeRecipientChanged(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    // ─── Listing (escrow transfer IN) ──────────────────────────────────────────

    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        SaleType saleType,
        uint256 endTime
    ) external whenNotPaused nonReentrant notBlacklisted {
        require(price > 0 && price <= MAX_PRICE, "Price invalid");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(
            nft.getApproved(tokenId) == address(this) ||
                nft.isApprovedForAll(msg.sender, address(this)),
            "Approve first"
        );
        if (saleType == SaleType.Auction) {
            require(endTime > block.timestamp, "Bad endTime");
        }

        // transfer NFT to escrow (this contract)
        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            saleType: saleType,
            price: price,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0
        });

        listedTokenIds[nftContract].push(tokenId);
        _sellerToListedTokenIds[msg.sender].add(tokenId);
        if (listedTokenIds[nftContract].length == 1) {
            listedNFTContracts.push(nftContract);
        }

        emit Listed(nftContract, tokenId, msg.sender, price, saleType, endTime);
    }

    // ─── Buy (escrow transfer OUT) ─────────────────────────────────────────────

    function buyItem(
        address nftContract,
        uint256 tokenId
    ) external payable whenNotPaused nonReentrant notBlacklisted {
        Listing storage item = listings[nftContract][tokenId];
        require(item.saleType == SaleType.FixedPrice, "Not fixed-price");
        uint256 price_ = item.price;
        require(item.price > 0, "Not listed");
        require(msg.value == item.price, "Wrong ETH");

        _removeListing(nftContract, tokenId, item.seller);

        uint256 fee = (item.price * tradingFee) / 10000;
        uint256 sellerAmount = item.price - fee;
        //payable(item.seller).transfer(sellerAmount);
        //if (fee > 0) payable(owner()).transfer(fee);
        Address.sendValue(payable(item.seller), sellerAmount);
        if (fee > 0) Address.sendValue(payable(feeRecipient), fee);

        IERC721(nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Purchase(nftContract, tokenId, msg.sender, price_);
    }

    // ─── Cancel (return to seller) ─────────────────────────────────────────────

    function cancelListing(
        address nftContract,
        uint256 tokenId
    ) external whenNotPaused nonReentrant notBlacklisted {
        Listing storage item = listings[nftContract][tokenId];
        require(item.price > 0, "Not listed");
        require(item.seller == msg.sender, "Not seller");
        if (item.saleType == SaleType.Auction) {
            require(item.highestBid == 0, "Bid exists");
        }

        _removeListing(nftContract, tokenId, msg.sender);
        IERC721(nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Cancelled(nftContract, tokenId, msg.sender);
    }

    // ─── Bidding ───────────────────────────────────────────────────────────────

    function placeBid(
        address nftContract,
        uint256 tokenId
    ) external payable whenNotPaused nonReentrant notBlacklisted {
        Listing storage item = listings[nftContract][tokenId];
        require(item.saleType == SaleType.Auction, "Not auction");
        require(block.timestamp < item.endTime, "Auction ended");
        require(msg.value > item.highestBid, "Bid too low");
        require(msg.value <= MAX_PRICE, "Too high");
        require(item.seller != address(0), "Not listed");

        if (item.highestBid > 0) {
            payable(item.highestBidder).transfer(item.highestBid);
        }
        item.highestBidder = msg.sender;
        item.highestBid = msg.value;

        emit NewBid(nftContract, tokenId, msg.sender, msg.value);
    }

    // ─── Finalize auction ──────────────────────────────────────────────────────

    function finalizeAuction(
        address nftAddress,
        uint256 tokenId
    ) external nonReentrant {
        Listing storage li = listings[nftAddress][tokenId];
        require(li.saleType == SaleType.Auction, "Not an auction");
        require(li.seller != address(0), "Listing not active");
        require(block.timestamp >= li.endTime, "Auction still running");

        if (li.highestBidder != address(0)) {
            // ✅ at least one bid – send NFT to winner & ETH to seller
            //IERC721(nftAddress).transferFrom(
            //    address(this),
            //    li.highestBidder,
            //    tokenId
            //);
            //(bool ok, ) = li.seller.call{value: li.highestBid}("");
            //require(ok, "ETH transfer failed");
            IERC721(nftAddress).safeTransferFrom(
                address(this),
                li.highestBidder,
                tokenId
            );

            uint256 fee = (li.highestBid * tradingFee) / 10_000;
            uint256 sellerAmount = li.highestBid - fee;

            Address.sendValue(payable(li.seller), sellerAmount);
            if (fee > 0) Address.sendValue(payable(feeRecipient), fee);

            emit AuctionFinalized(
                nftAddress,
                tokenId,
                li.highestBidder,
                li.highestBid
            );
        } else {
            // ✅ no bids – return NFT to seller
            IERC721(nftAddress).transferFrom(address(this), li.seller, tokenId);

            emit AuctionFinalized(nftAddress, tokenId, address(0), 0);
        }

        // delete listing & free storage
        delete listings[nftAddress][tokenId];
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getListedTokenIds(
        address seller
    ) external view returns (uint256[] memory) {
        uint256 count = _sellerToListedTokenIds[seller].length();
        uint256[] memory tokens = new uint256[](count);
        for (uint256 i; i < count; i++)
            tokens[i] = _sellerToListedTokenIds[seller].at(i);
        return tokens;
    }

    function getAllListedTokenIds(
        address nftAddress
    ) external view returns (uint256[] memory) {
        uint256[] storage arr = listedTokenIds[nftAddress];
        uint256 live;
        for (uint256 i; i < arr.length; i++)
            if (listings[nftAddress][arr[i]].seller != address(0)) live++;

        uint256[] memory res = new uint256[](live);
        uint256 idx;
        for (uint256 i; i < arr.length; i++)
            if (listings[nftAddress][arr[i]].seller != address(0))
                res[idx++] = arr[i];
        return res;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _removeListing(
        address nft,
        uint256 tokenId,
        address seller
    ) internal {
        _sellerToListedTokenIds[seller].remove(tokenId);

        // remove from global array
        uint256[] storage arr = listedTokenIds[nft];
        for (uint256 i; i < arr.length; i++) {
            if (arr[i] == tokenId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
        delete listings[nft][tokenId];
    }

    // ───────────────────────────────────────────────────────────────────────────
}
