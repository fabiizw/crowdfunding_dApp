// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "truffle/Assert.sol";
import "../contracts/User.sol";
import "../contracts/UserFactory.sol";

contract User_test {
    // User[3] user;
    // address[3] user_add;

    // function beforeAll() public {
    //     user_add[0] = 0x100273548141d467ea2d1393aAe593F072Da6704;
    //     user_add[1] = 0x72ec72aB75B04bbc44D26E469380bEB341aAe369;
    //     user_add[2] = 0x6EFDE477F8c6e16F2D0526d6b187a6C0b952D2Fc;
    //     user[0]=new User("James", 28, user_add[0]);
    //     user[1]=new User("Emily", 27, user_add[1]);
    //     user[2]=new User("Michael", 29, user_add[2]);
    // }

    // function test_getUserInfor() public {
    //     User.UserInfo[3] memory userInfo;
    //     for (uint i=0; i<3; ++i) {
    //         userInfo[i]=user[i].getUserInfo();
    //     }
    //     require(keccak256(abi.encodePacked(userInfo[0].name)) == keccak256(abi.encodePacked("James")), "Name should be James");
    //     require(userInfo[0].age == 28, "Age should be 28");
    //     require(userInfo[0].userAddress == user_add[0], "Address should match the deployer address");
    //     require(keccak256(abi.encodePacked(userInfo[1].name)) == keccak256(abi.encodePacked("Emily")), "Name should be Emily");
    //     require(userInfo[1].age == 27, "Age should be 27");
    //     require(userInfo[1].userAddress == user_add[1], "Address should match the deployer address");
    //     require(keccak256(abi.encodePacked(userInfo[2].name)) == keccak256(abi.encodePacked("Michael")), "Name should be Michael");
    //     require(userInfo[2].age == 29, "Age should be 29");
    //     require(userInfo[2].userAddress == user_add[2], "Address should match the deployer address");
    // }

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