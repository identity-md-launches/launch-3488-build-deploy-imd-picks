// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TestBase} from "./Vm.sol";
import {IMDPicks, IERC20, IIntake} from "../src/IMDPicks.sol";

/// Runs against Ethereum mainnet state: the real IMD token and the real IMD Intake v2.
/// FORK_RPC=https://ethereum-rpc.publicnode.com forge test --match-contract Fork
contract ForkTest is TestBase {
    IERC20 constant IMD = IERC20(0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7);
    IIntake constant INTAKE = IIntake(0xa43e6F75ee006411F79Ac1C84120606C2330DE82);
    address constant CREATOR = 0x83027AD9d0D5374335086c539dADD1db983441B0;
    address constant TREASURY = 0x4e0fA57Bde726079356537E2F34d671E9F41ADbc; // Intake payTo, holds IMD

    function test_fork_buy_pays_real_intake() public {
        string memory rpc = vm.envOr("FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return; // skipped without a fork RPC
        vm.createSelectFork(rpc);
        IMDPicks picks = new IMDPicks(IMD, INTAKE, CREATOR);
        address buyer = address(0xB4E7);
        uint256 t0 = IMD.balanceOf(TREASURY);
        require(t0 >= 3e18, "treasury holds no IMD at this block");
        vm.startPrank(TREASURY);
        IMD.transfer(buyer, 1e18);
        IMD.approve(address(picks), 1e18);
        picks.fundReserve(1e18);
        vm.stopPrank();
        uint256 c0 = IMD.balanceOf(CREATOR);
        uint256 t1 = IMD.balanceOf(TREASURY);
        vm.startPrank(buyer);
        IMD.approve(address(picks), 1e18);
        bytes32 id = picks.buy(3, 401810001, 401810001, "Boston Celtics at New York Knicks");
        vm.stopPrank();
        require(id != bytes32(0), "intake returned a request id");
        assertEq(IMD.balanceOf(buyer), 0, "buyer paid 1 IMD");
        assertEq(IMD.balanceOf(CREATOR) - c0, 5e17, "creator +0.5 IMD");
        assertEq(IMD.balanceOf(TREASURY) - t1, 5e17, "swarm treasury +0.5 IMD");
        assertEq(IMD.balanceOf(address(picks)), 1e18, "only the reserve remains");
    }
}
