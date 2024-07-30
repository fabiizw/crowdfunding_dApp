// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Project {
    struct ProjectDetails {
        uint id;
        address payable owner;
        string ipfsURL;
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
        string memory ipfsURL,
        uint goal,
        uint durationInMinutes,
        address payable owner) {
        project = ProjectDetails({
            id: projectId,
            owner: owner,
            ipfsURL: ipfsURL,
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

    function claimRefund() public {
        require(project.isOpen == false, "Project is still open.");
        require(project.amountRaised < project.goal, "Funding goal has been reached.");

        uint amount = contributions[msg.sender];
        require(amount > 0, "No contributions to refund.");

        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit RefundIssued(project.id, msg.sender, amount);
    }

    function closeProject() public {
        project.isOpen = false;
        emit ProjectClosed(project.id);
    }

    function getProjectDetails() public view returns (ProjectDetails memory) {
        return project;
    }
}