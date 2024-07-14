const express = require('express');
const { Web3 } = require('web3');
const ProjectFactory = require("./build/contracts/ProjectFactory.json");
const Project = require("./build/contracts/Project.json");
const UserFactory = require("./build/contracts/UserFactory.json");
const User = require("./build/contracts/User.json");

const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

const projectFactoryABI = ProjectFactory.abi;
const projectFactoryAddress = '0x3bD4684d0eE6173E8Cd3d77a485bbA92dbc94394'; // Update this with the deployed address
const projectFactoryContract = new web3.eth.Contract(projectFactoryABI, projectFactoryAddress);

const userFactoryABI = UserFactory.abi;
const userFactoryAddress = '0x19272F489e12B3e6F10f70972F63DD765c77aF7D'; // Update this with the deployed address
const userFactoryContract = new web3.eth.Contract(userFactoryABI, userFactoryAddress);

app.use(express.json());

// Helper function to convert BigInt values to strings and remove numerical index fields
function cleanAndConvert(obj) {
    const cleanedObj = {};
    for (let key in obj) {
        if (!isNaN(key) || key === "__length__") {
            continue; // Skip numerical keys and __length__
        }
        if (typeof obj[key] === 'bigint') {
            cleanedObj[key] = obj[key].toString();
        } else if (typeof obj[key] === 'object') {
            cleanedObj[key] = cleanAndConvert(obj[key]);
        } else {
            cleanedObj[key] = obj[key];
        }
    }
    return cleanedObj;
}

// Function to check if a user is registered
async function isUserRegistered(address) {
    return await userFactoryContract.methods.isUserRegistered(address).call();
}

app.post('/createUser', async (req, res) => {
    const { name, age, from } = req.body;

    try {
        const isRegistered = await isUserRegistered(from);
        if (isRegistered) {
            return res.status(403).json({ error: "User already registered." });
        }

        const receipt = await userFactoryContract.methods.createUser(name, age).send({ from, gas: 3000000 });
        console.log(receipt);
        res.json({
            message: "User created",
            name: name,
            address: from
        });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/createProject', async (req, res) => {
    const { name, description, goal, duration, from } = req.body;

    try {
        const isRegistered = await isUserRegistered(from);
        if (!isRegistered) {
            return res.status(403).json({ error: "User not registered." });
        }

        const receipt = await projectFactoryContract.methods.createProject(name, description, goal, duration).send({ from, gas: 3000000 });
        console.log(receipt);

        const projectAddress = receipt.events.ProjectCreated.returnValues.projectAddress;

        res.json({
            message: "Project created",
            name: name,
            from: from,
            goal: goal,
            projectAddress: projectAddress
        });
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/projects', async (req, res) => {
    try {
        const projectAddresses = await projectFactoryContract.methods.getProjects().call();
        const projectDetails = await Promise.all(projectAddresses.map(async (projectAddress) => {
            const projectContract = new web3.eth.Contract(Project.abi, projectAddress);
            const details = await projectContract.methods.getProjectDetails().call();
            // Convert amountRaised from Wei to Ether
            details.amountRaised = web3.utils.fromWei(details.amountRaised.toString(), 'ether');
            return {
                ...cleanAndConvert(details),
                projectAddress: projectAddress
            };
        }));
        res.json({ projects: projectDetails });
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/users', async (req, res) => {
    try {
        const userAddresses = await userFactoryContract.methods.getUsers().call();
        const userDetails = await Promise.all(userAddresses.map(async (userAddress) => {
            const userContract = new web3.eth.Contract(User.abi, userAddress);
            const details = await userContract.methods.getUserInfo().call();
            console.log(details)
            return cleanAndConvert(details);
        }));
        res.json({ users: userDetails });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/contribute', async (req, res) => {
    const { projectAddress, amount, from } = req.body;

    try {
        const isRegistered = await isUserRegistered(from);
        if (!isRegistered) {
            return res.status(403).json({ error: "User not registered." });
        }

        const projectContract = new web3.eth.Contract(Project.abi, projectAddress);
        const projectDetails = await projectContract.methods.getProjectDetails().call();

        if (!projectDetails.isOpen) {
            return res.status(403).json({ error: "Project is not open for contributions." });
        }

        const currentBlock = await web3.eth.getBlockNumber();
        if (currentBlock > projectDetails.deadline) {
            return res.status(403).json({ error: "The funding period for this project has ended." });
        }

        const receipt = await projectContract.methods.contribute().send({ from, value: web3.utils.toWei(amount, 'ether'), gas: 3000000 });
        console.log(receipt);
        res.json({
            message: "Contribution successful",
            projectAddress: projectAddress,
            from: from,
            amount: amount
        });
    } catch (error) {
        console.error("Error contributing to project:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/releaseFunds', async (req, res) => {
    const { projectAddress, from } = req.body;

    try {
        const isRegistered = await isUserRegistered(from);
        if (!isRegistered) {
            return res.status(403).json({ error: "User not registered." });
        }

        const projectContract = new web3.eth.Contract(Project.abi, projectAddress);
        const projectDetails = await projectContract.methods.getProjectDetails().call();

        if (from !== projectDetails.owner) {
            return res.status(403).json({ error: "Only the project owner can release funds." });
        }

        if (projectDetails.amountRaised < projectDetails.goal) {
            return res.status(403).json({ error: "Funding goal has not been reached." });
        }

        if (!projectDetails.isOpen) {
            return res.status(403).json({ error: "Funds have already been released or project is closed." });
        }

        const receipt = await projectContract.methods.releaseFunds().send({ from, gas: 3000000 });
        console.log(receipt);
        res.json({
            message: "Funds released successfully",
            projectAddress: projectAddress,
            from: from
        });
    } catch (error) {
        console.error("Error releasing funds:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
