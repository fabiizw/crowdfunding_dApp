// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Project.sol";
import "./UserFactory.sol";

contract ProjectFactory {
    Project[] public projects;
    uint public projectCount;
    UserFactory public userFactory;

    event ProjectCreated(
        uint indexed projectId,
        address projectAddress,
        address owner,
        string name,
        uint goal,
        uint deadline,
        address userAddress
    );

    constructor(address _userFactory) {
        userFactory = UserFactory(_userFactory);
    }
    function createProject(string memory name, string memory description, uint goal, uint duration) public {
        address userAddress = msg.sender; // Get the user address
        //How to verify that the user who can create a project is already registered or verified?
        

        projectCount++;
        Project newProject = new Project(projectCount, name, description, goal, duration, payable(msg.sender), userAddress);
        projects.push(newProject);
        emit ProjectCreated(projectCount, address(newProject), msg.sender, name, goal, duration, userAddress);
    }

    function getProjects() public view returns (Project[] memory) {
        return projects;
    }
}
