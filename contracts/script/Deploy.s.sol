// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "../test/Vm.sol";
import {IMDPicks, IERC20, IIntake} from "../src/IMDPicks.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC --account <your-keystore> --broadcast
contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (IMDPicks picks) {
        vm.startBroadcast();
        picks = new IMDPicks(
            IERC20(0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7), // IMD, Ethereum mainnet
            IIntake(0xa43e6F75ee006411F79Ac1C84120606C2330DE82), // IMD Intake v2
            0x83027AD9d0D5374335086c539dADD1db983441B0 // creator wallet
        );
        vm.stopBroadcast();
    }
}
