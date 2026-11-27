// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// The few Foundry cheatcodes these tests use, declared directly (no forge-std dependency).
interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes calldata) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
    function warp(uint256) external;
    function envOr(string calldata, string calldata) external view returns (string memory);
    function createSelectFork(string calldata) external returns (uint256);
    function recordLogs() external;
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b, string memory m) internal pure {
        require(a == b, m);
    }

    function assertTrue(bool c, string memory m) internal pure {
        require(c, m);
    }
}
