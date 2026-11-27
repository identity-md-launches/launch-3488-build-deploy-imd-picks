// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TestBase} from "./Vm.sol";
import {MockIMD, MockIntake} from "./Mocks.sol";
import {IMDPicks, IERC20, IIntake} from "../src/IMDPicks.sol";

contract IMDPicksTest is TestBase {
    address constant CREATOR = 0x83027AD9d0D5374335086c539dADD1db983441B0;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    MockIMD imd;
    MockIntake intake;
    IMDPicks picks;

    function setUp() public {
        imd = new MockIMD();
        intake = new MockIntake();
        picks = new IMDPicks(IERC20(address(imd)), IIntake(address(intake)), CREATOR);
        imd.mint(ALICE, 10e18);
        imd.mint(BOB, 10e18);
        imd.mint(address(this), 100e18);
        imd.approve(address(picks), 3e18);
        picks.fundReserve(3e18); // reserve covers three open purchases
    }

    function _buy(address who, uint64 eventId) internal returns (bytes32 id) {
        vm.startPrank(who);
        imd.approve(address(picks), 1e18);
        id = picks.buy(3, eventId, eventId, "Boston Celtics at New York Knicks");
        vm.stopPrank();
    }

    function test_split_is_exact() public {
        uint256 c0 = imd.balanceOf(CREATOR);
        _buy(ALICE, 401);
        assertEq(imd.balanceOf(ALICE), 9e18, "buyer pays exactly 1 IMD");
        assertEq(imd.balanceOf(CREATOR) - c0, 5e17, "creator gets 0.5 IMD");
        assertEq(imd.balanceOf(intake.treasury()), 5e17, "swarm gets 0.5 IMD");
        assertEq(imd.balanceOf(address(picks)), 3e18, "contract keeps none of the payment");
        assertEq(imd.allowance(address(picks), address(intake)), 0, "no leftover allowance");
        assertTrue(intake.lastAction() == bytes32("job.open@job-1"), "action id");
        (address t, bytes4 s) = intake.lastCallback();
        assertTrue(t == address(picks) && s == bytes4(0x4374622e), "result selector");
        assertTrue(intake.lastOnFailure() == bytes4(0x5a0df71e), "failure selector");
        assertEq(picks.liabilities(), 1e18, "liability recorded");
    }

    function test_duplicate_purchase_reverts() public {
        bytes32 id = _buy(ALICE, 401);
        vm.startPrank(ALICE);
        imd.approve(address(picks), 1e18);
        vm.expectRevert(abi.encodeWithSelector(IMDPicks.AlreadyPurchased.selector, id));
        picks.buy(3, 401, 401, "Boston Celtics at New York Knicks");
        vm.stopPrank();
        _buy(BOB, 401); // another wallet may buy the same event
    }

    function test_reserve_must_cover_open_purchases() public {
        _buy(ALICE, 1);
        _buy(ALICE, 2);
        _buy(ALICE, 3);
        vm.startPrank(ALICE);
        imd.approve(address(picks), 1e18);
        vm.expectRevert(abi.encodeWithSelector(IMDPicks.ReserveTooLow.selector, 4e18, 3e18));
        picks.buy(3, 4, 4, "Boston Celtics at New York Knicks");
        vm.stopPrank();
        assertEq(picks.openSlots(), 0, "no slots");
    }

    function test_result_delivery_and_dashboard() public {
        bytes32 id = _buy(ALICE, 401);
        bool ok = intake.complete(
            address(picks), abi.encodeCall(IMDPicks.onResult, (id, bytes32(uint256(7)), "ipfs://bafy/result.json"))
        );
        assertTrue(ok, "callback fits in 200k gas");
        IMDPicks.Purchase memory p = picks.purchase(id);
        assertTrue(p.status == IMDPicks.Status.Delivered, "delivered");
        assertEq(uint256(p.resultHash), 7, "hash stored");
        assertEq(picks.liabilities(), 0, "liability released");
        assertEq(picks.purchasesOf(ALICE).length, 1, "dashboard list");
        vm.prank(ALICE);
        vm.expectRevert(IMDPicks.NotRefundable.selector);
        picks.claimRefund(id);
    }

    function test_only_intake_can_call_back() public {
        bytes32 id = _buy(ALICE, 401);
        vm.expectRevert(IMDPicks.NotIntake.selector);
        picks.onResult(id, bytes32(0), "x");
        vm.expectRevert(IMDPicks.NotIntake.selector);
        picks.onFailure(id, 2, bytes32("failed"), 0, 0, "");
    }

    function test_failure_refund_full_price() public {
        bytes32 id = _buy(ALICE, 401);
        intake.complete(address(picks), abi.encodeCall(IMDPicks.onFailure, (id, 2, bytes32("failed"), 0, 0, "")));
        vm.prank(BOB);
        vm.expectRevert(IMDPicks.NotBuyer.selector);
        picks.claimRefund(id);
        vm.prank(ALICE);
        picks.claimRefund(id);
        assertEq(imd.balanceOf(ALICE), 10e18, "refunded in full");
        vm.prank(ALICE);
        vm.expectRevert(IMDPicks.NotRefundable.selector);
        picks.claimRefund(id);
        _buy(ALICE, 401); // may buy again after a refund
    }

    function test_timeout_refund_and_late_result_ignored() public {
        bytes32 id = _buy(ALICE, 401);
        vm.prank(ALICE);
        vm.expectRevert(IMDPicks.NotRefundable.selector);
        picks.claimRefund(id);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(ALICE);
        picks.claimRefund(id);
        intake.complete(address(picks), abi.encodeCall(IMDPicks.onResult, (id, bytes32(uint256(1)), "late")));
        assertTrue(picks.purchase(id).status == IMDPicks.Status.Refunded, "stays refunded");
        assertEq(picks.liabilities(), 0, "no double release");
    }

    function test_creator_withdraws_only_surplus() public {
        _buy(ALICE, 1);
        vm.expectRevert(IMDPicks.NotCreator.selector);
        picks.withdrawSurplus(1);
        vm.startPrank(CREATOR);
        vm.expectRevert(abi.encodeWithSelector(IMDPicks.ReserveTooLow.selector, 4e18, 3e18));
        picks.withdrawSurplus(3e18);
        picks.withdrawSurplus(2e18);
        vm.stopPrank();
        assertEq(imd.balanceOf(address(picks)), 1e18, "open purchase still covered");
    }

    function test_self_exclusion() public {
        vm.prank(ALICE);
        picks.selfExclude(7 days);
        vm.startPrank(ALICE);
        imd.approve(address(picks), 1e18);
        vm.expectRevert();
        picks.buy(3, 9, 9, "A at B");
        picks.selfExclude(1 days); // cannot shorten
        vm.stopPrank();
        assertEq(picks.excludedUntil(ALICE), block.timestamp + 7 days, "not shortened");
        vm.warp(block.timestamp + 7 days);
        _buy(ALICE, 9);
    }

    function test_label_and_league_validation() public {
        vm.startPrank(ALICE);
        imd.approve(address(picks), 1e18);
        vm.expectRevert(IMDPicks.BadLabel.selector);
        picks.buy(3, 1, 1, 'Quote " breaks JSON');
        vm.expectRevert(IMDPicks.BadLabel.selector);
        picks.buy(3, 1, 1, "");
        vm.expectRevert(IMDPicks.UnknownLeague.selector);
        picks.buy(11, 1, 1, "A at B");
        vm.stopPrank();
    }

    function test_body_is_the_fixed_job() public view {
        bytes memory b = picks.bodyOf(3, 401810001, 401810001, "Boston Celtics at New York Knicks");
        assertTrue(b.length > 500 && b.length < 16384, "body size within intake limit");
        assertTrue(b[0] == "{" && b[b.length - 1] == "}", "json object");
    }
}
