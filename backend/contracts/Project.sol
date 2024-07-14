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

    event ContributionMade(uint indexed projectId, address indexed contributor, uint amount);
    event FundsReleased(uint indexed projectId, uint amount);
    event RefundIssued(uint indexed projectId, address indexed contributor, uint amount);

    constructor(
        uint projectId,
        string memory name,
        string memory description,
        uint goal,
        uint duration,
        address payable owner) {
        project = ProjectDetails({
            id: projectId,
            owner: owner,
            name: name,
            description: description,
            goal: goal,
            amountRaised: 0,
            deadline: block.number + duration,
            isOpen: true
        });
    }

    function contribute() public payable {
        require(project.isOpen, "Project is not open for contributions.");
        require(block.number <= project.deadline, "The funding period for this project has ended.");
        require(msg.value > 0, "Contribution amount must be greater than zero.");

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

    function refund() public {
        require(block.number > project.deadline, "Project deadline has not yet passed.");
        require(project.amountRaised < project.goal, "Funding goal was reached; no refunds available.");
        require(contributions[msg.sender] > 0, "No contributions found for refund.");

        uint refundAmount = contributions[msg.sender];
        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(refundAmount);

        emit RefundIssued(project.id, msg.sender, refundAmount);
    }

    function getProjectDetails() public view returns (ProjectDetails memory) {
       return project;
    }
}
