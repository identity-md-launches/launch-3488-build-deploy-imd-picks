// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// The IMD Intake (v2): takes a payment and an ask in one transaction and calls back with the result.
interface IIntake {
    struct Callback {
        address target;
        bytes4 selector;
    }

    function requestWithFailure(
        bytes32 action,
        bytes calldata body,
        Callback calldata callback,
        bytes4 onFailure,
        address asset,
        uint256 amount
    ) external returns (bytes32 requestId);
}

/// @title IMD Picks
/// @notice One purchase = exactly 1 IMD. 0.5 IMD goes straight to the creator wallet and 0.5 IMD pays
/// the IMD Swarm (job.open on the IMD Intake) to research one sporting event. The result's hash and URI
/// come back onchain. A failed or missing analysis is refunded in full (1 IMD) from a refund reserve
/// that must cover every open purchase before a new one is accepted.
/// @dev No owner, no upgrade, no pause, no fee switch. Everything that matters is immutable.
contract IMDPicks {
    // ------------------------------------------------------------------ constants
    bytes32 public constant ACTION = "job.open@job-1";
    uint256 public constant PRICE = 1e18;
    uint256 public constant SWARM_SHARE = 5e17;
    uint256 public constant CREATOR_SHARE = 5e17;
    /// A purchase with no result after this long can be refunded by its buyer.
    uint256 public constant RESULT_TIMEOUT = 14 days;
    uint256 public constant MAX_SELF_EXCLUSION = 3650 days;
    uint8 public constant LEAGUE_COUNT = 11;
    uint256 public constant MAX_LABEL = 120;

    // ------------------------------------------------------------------ immutables
    IERC20 public immutable imd;
    IIntake public immutable intake;
    address public immutable creator;

    // ------------------------------------------------------------------ state
    enum Status {
        None,
        Pending,
        Delivered,
        Failed,
        Refunded
    }

    struct Purchase {
        address buyer;
        uint64 paidAt;
        Status status;
        uint8 league;
        uint64 eventId;
        uint64 competitionId;
        bytes32 eventKey;
        bytes32 resultHash;
        string uri;
    }

    mapping(bytes32 requestId => Purchase) internal _purchases;
    /// buyer => eventKey => the request that bought it (zero when never bought)
    mapping(address buyer => mapping(bytes32 eventKey => bytes32 requestId)) public requestOf;
    mapping(address buyer => bytes32[]) internal _byBuyer;
    bytes32[] internal _all;
    /// Buyer-chosen lockout: no purchases until this time. It cannot be shortened.
    mapping(address buyer => uint64) public excludedUntil;
    /// IMD held back for refunds of purchases that are pending or failed and unclaimed.
    uint256 public liabilities;
    uint256 private _lock = 1;

    // ------------------------------------------------------------------ events
    event Purchased(
        address indexed buyer,
        bytes32 indexed requestId,
        bytes32 indexed eventKey,
        uint8 league,
        uint64 eventId,
        uint64 competitionId,
        string label
    );
    event Delivered(bytes32 indexed requestId, bytes32 resultHash, string uri);
    event AnalysisFailed(bytes32 indexed requestId, uint8 status, bytes32 reason);
    event Refunded(bytes32 indexed requestId, address indexed buyer, uint256 amount);
    event ReserveFunded(address indexed from, uint256 amount);
    event SurplusWithdrawn(uint256 amount);
    event SelfExcluded(address indexed buyer, uint64 until);

    // ------------------------------------------------------------------ errors
    error UnknownLeague();
    error BadLabel();
    error AlreadyPurchased(bytes32 requestId);
    error SelfExclusionActive(uint64 until);
    error ReserveTooLow(uint256 needed, uint256 held);
    error NotIntake();
    error NotBuyer();
    error NotRefundable();
    error NotCreator();
    error TooLong();
    error TransferFailed();
    error Reentrant();
    error DuplicateRequest();
    error ZeroAddress();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(IERC20 imd_, IIntake intake_, address creator_) {
        if (address(imd_) == address(0) || address(intake_) == address(0) || creator_ == address(0)) {
            revert ZeroAddress();
        }
        imd = imd_;
        intake = intake_;
        creator = creator_;
    }

    // ------------------------------------------------------------------ buying
    /// @notice Pay 1 IMD for one Swarm analysis of one ESPN event. Approve this contract for 1 IMD first.
    /// @param league index into the fixed league table (see leagueOf)
    /// @param eventId ESPN event id
    /// @param competitionId ESPN competition id (a bout or a match inside a card or a tournament)
    /// @param label the matchup in plain ASCII, e.g. "Boston Celtics at New York Knicks"
    function buy(uint8 league, uint64 eventId, uint64 competitionId, string calldata label)
        external
        nonReentrant
        returns (bytes32 requestId)
    {
        if (league >= LEAGUE_COUNT) revert UnknownLeague();
        uint64 until = excludedUntil[msg.sender];
        if (until > block.timestamp) revert SelfExclusionActive(until);
        _checkLabel(label);

        bytes32 key = eventKeyOf(league, eventId, competitionId);
        bytes32 prior = requestOf[msg.sender][key];
        if (prior != bytes32(0) && _purchases[prior].status != Status.Refunded) revert AlreadyPurchased(prior);

        // Every open purchase must stay refundable: the reserve held here covers them all.
        uint256 held = imd.balanceOf(address(this));
        if (held < liabilities + PRICE) revert ReserveTooLow(liabilities + PRICE, held);

        _pull(msg.sender, PRICE);
        _send(creator, CREATOR_SHARE);
        if (!imd.approve(address(intake), SWARM_SHARE)) revert TransferFailed();
        requestId = intake.requestWithFailure(
            ACTION,
            bodyOf(league, eventId, competitionId, label),
            IIntake.Callback({target: address(this), selector: this.onResult.selector}),
            this.onFailure.selector,
            address(imd),
            SWARM_SHARE
        );
        if (requestId == bytes32(0) || _purchases[requestId].status != Status.None) revert DuplicateRequest();

        Purchase storage p = _purchases[requestId];
        p.buyer = msg.sender;
        p.paidAt = uint64(block.timestamp);
        p.status = Status.Pending;
        p.league = league;
        p.eventId = eventId;
        p.competitionId = competitionId;
        p.eventKey = key;
        requestOf[msg.sender][key] = requestId;
        _byBuyer[msg.sender].push(requestId);
        _all.push(requestId);
        liabilities += PRICE;

        emit Purchased(msg.sender, requestId, key, league, eventId, competitionId, label);
    }

    // ------------------------------------------------------------------ intake callbacks
    /// @notice The Intake hands over a finished job: keccak-256 of result.json and where it lives.
    function onResult(bytes32 requestId, bytes32 resultHash, string calldata uri) external {
        if (msg.sender != address(intake)) revert NotIntake();
        Purchase storage p = _purchases[requestId];
        if (p.status != Status.Pending) return; // unknown, refunded or settled: nothing to do
        p.status = Status.Delivered;
        p.resultHash = resultHash;
        p.uri = uri;
        liabilities -= PRICE;
        emit Delivered(requestId, resultHash, uri);
    }

    /// @notice The Intake reports a refusal (status 1) or no result (status 2). Moves no value:
    /// the buyer claims the refund in a later call.
    function onFailure(bytes32 requestId, uint8 status, bytes32 reason, uint16, uint16, bytes calldata) external {
        if (msg.sender != address(intake)) revert NotIntake();
        Purchase storage p = _purchases[requestId];
        if (p.status != Status.Pending) return;
        p.status = Status.Failed;
        emit AnalysisFailed(requestId, status, reason);
    }

    // ------------------------------------------------------------------ refunds and reserve
    /// @notice Refund the full 1 IMD for a failed analysis, or one with no result after RESULT_TIMEOUT.
    function claimRefund(bytes32 requestId) external nonReentrant {
        Purchase storage p = _purchases[requestId];
        if (p.buyer != msg.sender) revert NotBuyer();
        bool late = p.status == Status.Pending && block.timestamp > uint256(p.paidAt) + RESULT_TIMEOUT;
        if (p.status != Status.Failed && !late) revert NotRefundable();
        p.status = Status.Refunded;
        liabilities -= PRICE;
        _send(msg.sender, PRICE);
        emit Refunded(requestId, msg.sender, PRICE);
    }

    /// @notice Anyone may add IMD to the refund reserve. It can only leave as a refund or as surplus to the creator.
    function fundReserve(uint256 amount) external nonReentrant {
        _pull(msg.sender, amount);
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice The creator may take back reserve that no open purchase could need.
    function withdrawSurplus(uint256 amount) external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        uint256 held = imd.balanceOf(address(this));
        if (held < liabilities + amount) revert ReserveTooLow(liabilities + amount, held);
        _send(creator, amount);
        emit SurplusWithdrawn(amount);
    }

    // ------------------------------------------------------------------ responsible play
    /// @notice Lock your own wallet out of purchases for `duration` seconds. It can be extended, never shortened.
    function selfExclude(uint64 duration) external {
        if (duration > MAX_SELF_EXCLUSION) revert TooLong();
        uint64 until = uint64(block.timestamp) + duration;
        if (until > excludedUntil[msg.sender]) excludedUntil[msg.sender] = until;
        emit SelfExcluded(msg.sender, excludedUntil[msg.sender]);
    }

    // ------------------------------------------------------------------ views
    function purchase(bytes32 requestId) external view returns (Purchase memory) {
        return _purchases[requestId];
    }

    function purchasesOf(address buyer) external view returns (bytes32[] memory) {
        return _byBuyer[buyer];
    }

    function purchaseCount() external view returns (uint256) {
        return _all.length;
    }

    function purchaseIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory ids) {
        uint256 n = _all.length;
        if (offset >= n) return new bytes32[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        ids = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) ids[i - offset] = _all[i];
    }

    /// @notice How many more purchases the reserve can cover right now.
    function openSlots() external view returns (uint256) {
        uint256 held = imd.balanceOf(address(this));
        return held > liabilities ? (held - liabilities) / PRICE : 0;
    }

    function eventKeyOf(uint8 league, uint64 eventId, uint64 competitionId) public pure returns (bytes32) {
        return keccak256(abi.encode(league, eventId, competitionId));
    }

    /// @notice ESPN API path and display name for each supported league.
    function leagueOf(uint8 league) public pure returns (string memory path, string memory name) {
        if (league == 0) return ("mma/ufc", "UFC");
        if (league == 1) return ("hockey/nhl", "NHL");
        if (league == 2) return ("football/nfl", "NFL");
        if (league == 3) return ("basketball/nba", "NBA");
        if (league == 4) return ("baseball/mlb", "MLB");
        if (league == 5) return ("soccer/eng.1", "Premier League");
        if (league == 6) return ("soccer/esp.1", "LaLiga");
        if (league == 7) return ("soccer/uefa.champions", "UEFA Champions League");
        if (league == 8) return ("soccer/usa.1", "MLS");
        if (league == 9) return ("tennis/atp", "ATP tennis");
        if (league == 10) return ("tennis/wta", "WTA tennis");
        revert UnknownLeague();
    }

    /// @notice The exact job body sent to the IMD Intake: compact JSON, fixed skill and outputs.
    function bodyOf(uint8 league, uint64 eventId, uint64 competitionId, string calldata label)
        public
        pure
        returns (bytes memory)
    {
        (string memory path, string memory name) = leagueOf(league);
        string memory e = _u(eventId);
        return abi.encodePacked(
            '{"objective":"IMD Picks paid analysis of one upcoming ',
            name,
            " event: ",
            label,
            ". ESPN event id ",
            e,
            ", competition id ",
            _u(competitionId),
            ". Public data: https://site.api.espn.com/apis/site/v2/sports/",
            path,
            "/summary?event=",
            e,
            " and https://site.api.espn.com/apis/site/v2/sports/",
            path,
            "/scoreboard. Research statistics, injuries, recent form, the matchup, current public betting odds, weather where it applies and recent news, and cite sources. ",
            "Write artifacts/pick.json as one JSON object with keys eventId, competitionId, league, matchup, market (moneyline), selection (one competitor name exactly as ESPN lists it, or No bet), americanOdds (number), probabilities (object of competitor name, and Draw where possible, to a 0-1 win probability), expectedValue (profit per 1 unit staked at americanOdds), risk (low, medium or high), confidence (0-1), summary (two sentences), factors (object with keys statistics, injuries, form, matchup, odds, weather, news, one or two sentences each) and sources (array of URLs). ",
            "Write artifacts/analysis.md with the full reasoning, a risk section and the sources. Never promise winnings: every outcome is uncertain. If the event cannot be found or has already started, say so and set selection to No bet.",
            '","skill":"research-report","outputs":[{"name":"pick","path":"artifacts/pick.json","mediaType":"application/json"},{"name":"analysis","path":"artifacts/analysis.md","mediaType":"text/markdown"}]}'
        );
    }

    // ------------------------------------------------------------------ internals
    /// Letters, digits, space and . , ' & - ( ) / : only, so the body is always valid JSON.
    function _checkLabel(string calldata label) internal pure {
        bytes calldata b = bytes(label);
        if (b.length == 0 || b.length > MAX_LABEL) revert BadLabel();
        for (uint256 i; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c == " "
                || c == "." || c == "," || c == "'" || c == "&" || c == "-" || c == "(" || c == ")" || c == "/"
                || c == ":";
            if (!ok) revert BadLabel();
        }
    }

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) len++;
        bytes memory out = new bytes(len);
        while (v != 0) {
            out[--len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(out);
    }

    function _pull(address from, uint256 amount) internal {
        (bool ok, bytes memory ret) =
            address(imd).call(abi.encodeCall(IERC20.transferFrom, (from, address(this), amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function _send(address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = address(imd).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
