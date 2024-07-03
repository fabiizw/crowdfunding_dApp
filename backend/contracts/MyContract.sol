// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Crowdfunding Contract
 * @dev This contract manages a decentralized crowdfunding platform using Ethereum blockchain. It allows users to create, fund, and manage crowdfunding projects with smart contracts to ensure transparency and security.
 */
contract Crowdfunding {
    // Struct for project details
    struct Project {
        uint id;                // Unique project identifier
        address payable owner;  // Address of the project creator, who will receive the funds
        string name;            // Name of the project
        string description;     // Detailed description of the project
        uint goal;              // Funding goal that needs to be reached
        uint amountRaised;      // Total amount raised by the project so far
        uint deadline;          // Timestamp of when the project funding period will end
        bool isOpen;            // Flag to check if the project is still open for funding
    }

    // Mapping from project ID to project details
    mapping(uint => Project) public projects;
    // Mapping from project ID to a mapping of addresses and their contributions
    mapping(uint => mapping(address => uint)) public contributions;

    // Total number of projects (used to generate unique IDs)
    uint public projectCount;

    // Event to emit when a new project is created
    event ProjectCreated(
        uint indexed projectId,
        address indexed owner,
        string name,
        uint goal,
        uint deadline
    );

    // Event to emit when a contribution is made
    event ContributionMade(
        uint indexed projectId,
        address indexed contributor,
        uint amount
    );

    // Event to emit when funds are released to the project owner
    event FundsReleased(
        uint indexed projectId,
        uint amount
    );

    // Event to emit when a refund is made to a contributor
    event RefundIssued(
        uint indexed projectId,
        address indexed contributor,
        uint amount
    );

    /**
     * @dev Creates a new project with the specified details. Only callable by registered users.
     * @param name Name of the new project.
     * @param description Description of the new project.
     * @param goal The funding goal to be reached.
     * @param duration Duration in seconds for which the project will accept contributions.
     */
    function createProject(string memory name, string memory description, uint goal, uint duration) public {
        uint projectId = ++projectCount;  // Increment project count to get new project ID
        uint deadline = block.timestamp + duration;

        projects[projectId] = Project({
            id: projectId,
            owner: payable(msg.sender),
            name: name,
            description: description,
            goal: goal,
            amountRaised: 0,
            deadline: deadline,
            isOpen: true
        });

        emit ProjectCreated(projectId, msg.sender, name, goal, deadline);
    }

    /**
     * @dev Allows users to contribute to a project. Contributions can only be made if the project is open and not yet expired.
     * @param projectId The ID of the project to contribute to.
     */
    function contribute(uint projectId) public payable {
        Project storage project = projects[projectId];

        require(project.isOpen, "Project is not open for contributions.");
        require(block.timestamp <= project.deadline, "The funding period for this project has ended.");
        require(msg.value > 0, "Contribution amount must be greater than zero.");

        project.amountRaised += msg.value;
        contributions[projectId][msg.sender] += msg.value;

        emit ContributionMade(projectId, msg.sender, msg.value);
    }

    /**
     * @dev Releases funds to the project owner if the funding goal is met. Can only be called by the project owner or contract admin.
     * @param projectId The ID of the project for which funds are to be released.
     */
    function releaseFunds(uint projectId) public {
        Project storage project = projects[projectId];

        require(msg.sender == project.owner, "Only the project owner can release funds.");
        require(project.amountRaised >= project.goal, "Funding goal has not been reached.");
        require(project.isOpen, "Funds have already been released or project is closed.");

        project.owner.transfer(project.amountRaised);
        project.isOpen = false;  // Close the project after releasing funds

        emit FundsReleased(projectId, project.amountRaised);
    }

    /**
     * @dev Issues refunds to contributors if the project does not meet its funding goal by the deadline. Can be called by contributors.
     * @param projectId The ID of the project from which to claim a refund.
     */
    function refund(uint projectId) public {
        Project storage project = projects[projectId];

        require(block.timestamp > project.deadline, "Project deadline has not yet passed.");
        require(project.amountRaised < project.goal, "Funding goal was reached; no refunds available.");
        require(contributions[projectId][msg.sender] > 0, "No contributions found for refund.");

        uint refundAmount = contributions[projectId][msg.sender];
        contributions[projectId][msg.sender] = 0;  // Reset contribution to zero after refund
        payable(msg.sender).transfer(refundAmount);

        emit RefundIssued(projectId, msg.sender, refundAmount);
    }
}
