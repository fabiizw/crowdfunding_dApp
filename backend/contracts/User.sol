// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title User Contract
 * @dev Stores data and manages actions for a single user.
 */
contract User {
    struct UserInfo {
        string name;
        uint age;
        address userAddress;
    }

    UserInfo public userInfo;

    constructor(string memory _name, uint _age, address _userAddress) {
        userInfo.name = _name;
        userInfo.age = _age;
        userInfo.userAddress = _userAddress;
    }

    function getUserInfo() public view returns (UserInfo memory) {
        return userInfo;
    }
}
