// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title User Contract
 * @dev Stores data and manages actions for a single user.
 */
contract User {
    struct UserInfo {
        string ipfsURL;
        address userAddress;
    }

    UserInfo public userInfo;

    constructor(string memory _ipfsURL, address _userAddress) {
        userInfo.ipfsURL = _ipfsURL;
        userInfo.userAddress = _userAddress;
    }

    function getUserInfo() public view returns (UserInfo memory) {
        return userInfo;
    }
}