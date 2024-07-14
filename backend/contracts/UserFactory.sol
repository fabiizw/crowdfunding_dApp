// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./User.sol";

/**
 * @title User Factory
 * @dev Manages creation and retrieval of user contracts.
 */
contract UserFactory {
    User[] public users;
    mapping(address => bool) public registeredUsers;

    event UserCreated(address userAddress);

    function createUser(string memory _name, uint _age) public {
        require(!registeredUsers[msg.sender], "User already registered.");

        User newUser = new User(_name, _age, msg.sender);
        users.push(newUser);
        registeredUsers[msg.sender] = true;
        emit UserCreated(address(newUser));
    }

    function getUsers() public view returns (User[] memory) {
        return users;
    }

    function isUserRegistered(address _user) public view returns (bool) {
        return registeredUsers[_user];
    }
}