// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Project {
    struct ProjectDetails {
        uint id;
        address payable owner;
        string name;
        string description;
        uint goal;
        uint amountRaised;
        uint deadline;
        bool isOpen;
    }

    ProjectDetails public project;
    mapping(address => uint) public contributions;
    address[] public contributors;

    event ContributionMade(uint indexed projectId, address indexed contributor, uint amount);
    event FundsReleased(uint indexed projectId, uint amount);
    event RefundIssued(uint indexed projectId, address indexed contributor, uint amount);
    event ProjectClosed(uint indexed projectId);

    constructor(
        uint projectId,
        string memory name,
        string memory description,
        uint goal,
        uint durationInMinutes,
        address payable owner) {
        project = ProjectDetails({
            id: projectId,
            owner: owner,
            name: name,
            description: description,
            goal: goal,
            amountRaised: 0,
            deadline: block.timestamp + (durationInMinutes * 1 minutes),
            isOpen: true
        });
    }

    function contribute() public payable {
        require(project.isOpen, "Project is not open for contributions.");
        require(block.timestamp <= project.deadline, "The funding period for this project has ended.");
        require(msg.value > 0, "Contribution amount must be greater than zero.");

        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }

        project.amountRaised += msg.value;
        contributions[msg.sender] += msg.value;

        emit ContributionMade(project.id, msg.sender, msg.value);
    }

    function releaseFunds() public {
        require(msg.sender == project.owner, "Only the project owner can release funds.");
        require(project.amountRaised >= project.goal, "Funding goal has not been reached.");
        require(project.isOpen, "Funds have already been released or project is closed.");

        project.owner.transfer(project.amountRaised);
        project.isOpen = false;

        emit FundsReleased(project.id, project.amountRaised);
    }

    function refundAll() internal {
        if (contributors.length == 0) {
            return;
        }

        for (uint i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            uint amount = contributions[contributor];
            if (amount > 0) {
                contributions[contributor] = 0;
                payable(contributor).transfer(amount);
                emit RefundIssued(project.id, contributor, amount);
            }
        }
    }

    function closeProject() public {
        refundAll();
        project.isOpen = false;
        emit ProjectClosed(project.id);
    }

    function getProjectDetails() public view returns (ProjectDetails memory) {
        return project;
    }
}