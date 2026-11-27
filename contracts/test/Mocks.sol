// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IIntake} from "../src/IMDPicks.sol";

contract MockIMD {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
        return true;
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[to] += a;
        return true;
    }
}

/// Mirrors the Intake's observable behaviour: pulls `amount` (>= price) of `asset` and returns a fresh id.
contract MockIntake {
    uint256 public constant PRICE = 5e17;
    address public treasury = address(0x7EA5);
    uint256 public n;
    bytes public lastBody;
    bytes32 public lastAction;
    IIntake.Callback public lastCallback;
    bytes4 public lastOnFailure;

    function requestWithFailure(
        bytes32 action,
        bytes calldata body,
        IIntake.Callback calldata cb,
        bytes4 onFailure,
        address asset,
        uint256 amount
    ) external returns (bytes32) {
        require(amount >= PRICE, "PriceNotMet");
        MockIMD(asset).transferFrom(msg.sender, treasury, amount);
        lastBody = body;
        lastAction = action;
        lastCallback = cb;
        lastOnFailure = onFailure;
        return keccak256(abi.encode(++n));
    }

    function complete(address target, bytes calldata data) external returns (bool ok) {
        (ok,) = target.call{gas: 200_000}(data);
    }
}
