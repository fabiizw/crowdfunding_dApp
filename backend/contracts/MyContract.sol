// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0; 
//creating smart contract 
contract MyContract { 
    int private myNumber = 10; 
//defining function 
    function getNumber() public view returns (int) { 
        return myNumber; 
    } 
  
    function setNumber(int _number) public { 
        myNumber = _number; 
    } 
}