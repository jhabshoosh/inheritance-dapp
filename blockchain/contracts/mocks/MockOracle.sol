// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

contract MockOracle {
    LinkTokenInterface public LINK;

    constructor(address _link) {
        LINK = LinkTokenInterface(_link);
    }

    function fulfillOracleRequest(
        bytes32 requestId,
        uint256 payment,
        address callbackAddress,
        bytes4 callbackFunctionId,
        uint256 expiration,
        bytes32 data
    ) external returns (bool) {
        return true;
    }
}