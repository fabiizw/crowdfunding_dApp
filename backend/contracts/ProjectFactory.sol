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
        uint deadline
    );

    constructor(address _userFactory) {
        userFactory = UserFactory(_userFactory);
    }

    function createProject(string memory name, string memory description, uint goal, uint duration) public {
        projectCount++;
        Project newProject = new Project(projectCount, name, description, goal, duration, payable(msg.sender));
        projects.push(newProject);
        emit ProjectCreated(projectCount, address(newProject), msg.sender, name, goal, duration);
    }

    function getProjects() public view returns (Project[] memory) {
        return projects;
    }
}
