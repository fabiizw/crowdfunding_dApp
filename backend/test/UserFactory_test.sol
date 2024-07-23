// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "truffle/Assert.sol";
import "../contracts/UserFactory.sol";
import "../contracts/User.sol";

contract UserFactory_test {
    User[] user;
    address[3] user_add;

    function beforeAll() public {
        user_add[0] = 0x100273548141d467ea2d1393aAe593F072Da6704;
        user_add[1] = 0x72ec72aB75B04bbc44D26E469380bEB341aAe369;
        user_add[2] = 0x6EFDE477F8c6e16F2D0526d6b187a6C0b952D2Fc;
    }

    // test create a single user
    function createUser_test() public {
        UserFactory userFactory;
        userFactory.createUser("James", 28);
    }

    // test create different users with the same address
    function createUser_test2() public {
        UserFactory userFactory;
        bool success=false;
        userFactory.createUser("James", 28);
        try userFactory.createUser("Emily", 27) {
            success=true;
        } catch  {
            success=false;
        }
        require(success == false, "User should not be able to register twice");
    }

    // test create different users with the same address
    function getUsers_test2() public {
        UserFactory userFactory;
        userFactory.createUser("James", 28);
        user=userFactory.getUsers();
        User.UserInfo memory userInfo=user[0].getUserInfo();
        require(keccak256(abi.encodePacked(userInfo.name)) == keccak256(abi.encodePacked("James")), "Name should be James");
        require(userInfo.age == 28, "Age should be 28");
    }
}