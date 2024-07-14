// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./User.sol";

/**
 * @title User Factory
 * @dev Manages creation and retrieval of user contracts.
 */
contract UserFactory {
    User[] public users;

    event UserCreated(address userAddress);

    function createUser(string memory _name, uint _age) public {
        User newUser = new User(_name, _age, msg.sender);
        users.push(newUser);
        emit UserCreated(address(newUser));
    }

    function getUsers() public view returns (User[] memory) {
        return users;
    }
}
