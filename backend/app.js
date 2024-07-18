const express = require('express');
const { Web3 } = require('web3');
const ProjectFactory = require("./build/contracts/ProjectFactory.json");
const Project = require("./build/contracts/Project.json");
const UserFactory = require("./build/contracts/UserFactory.json");
const User = require("./build/contracts/User.json");

async function run() {
// Import Helia and UnixFS
const { createHelia } = await import('helia');
const { unixfs } = await import('@helia/unixfs');

const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// Initialize Helia
const helia = await createHelia();
const fs = unixfs(helia);

const projectFactoryABI = ProjectFactory.abi;
const projectFactoryAddress = '0x78e49005cF7c50DA8C2Ab012FD6b4edb57E8baF0'; // Update this with the deployed address
const projectFactoryContract = new web3.eth.Contract(projectFactoryABI, projectFactoryAddress);

const userFactoryABI = UserFactory.abi;
const userFactoryAddress = '0x3D69067bE760C4B6Aaa2F8DFC5Ffe5a201581555'; // Update this with the deployed address
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
            cleanedObj[key] = obj[key].toString(); // Keep as string
        } else if (typeof obj[key] === 'object') {
            cleanedObj[key] = cleanAndConvert(obj[key]);
        } else {
            cleanedObj[key] = obj[key];
        }
    }
    return cleanedObj;
}

// Helper function to format timestamp to human-readable date
function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000); // Convert to milliseconds
    return date.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
}

// Check if a user is registered
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
        
        const balance = await web3.eth.getBalance(from);

        res.json({
            message: "User created",
            name: name,
            address: from,
            balance: web3.utils.fromWei(balance.toString(), 'ether')
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

        // Upload project description to IPFS
        //const ipfsDetails = { description };
        const encoder = new TextEncoder()
        const bytes = encoder.encode(description)
        const cid = await fs.addBytes(bytes)
        const ipfsHash = cid.toString();

        const receipt = await projectFactoryContract.methods.createProject(name, ipfsHash, goal, duration).send({ from, gas: 3000000 });
        console.log(receipt);

        const projectAddress = receipt.events.ProjectCreated.returnValues.projectAddress;

        res.json({
            message: "Project created",
            name: name,
            from: from,
            goal: goal,
            projectAddress: projectAddress,
            ipfsHash: ipfsHash
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
            // Convert goal and amountRaised from Wei to Ether
            details.amountRaised = web3.utils.fromWei(details.amountRaised.toString(), 'ether');
            details.deadline = formatTimestamp(parseInt(details.deadline.toString())); // Convert deadline to human-readable format
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
            const balance = await web3.eth.getBalance(details.userAddress);
            console.log(details);
            return {
                ...cleanAndConvert(details),
                balance: web3.utils.fromWei(balance.toString(), 'ether')
            };
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

async function checkProjects() {
    try {
        const projectAddresses = await projectFactoryContract.methods.getProjects().call();
        await Promise.all(projectAddresses.map(async (projectAddress) => {
            const projectContract = new web3.eth.Contract(Project.abi, projectAddress);
            const details = await projectContract.methods.getProjectDetails().call();
            const amountRaisedInEth = web3.utils.fromWei(details.amountRaised.toString(), 'ether'); // Convert amountRaised from Wei to Ether
            // Automatically trigger refundAll if the deadline has passed

            const currentTimestamp = Math.floor(Date.now() / 1000);
            console.log(`Current timestamp: ${currentTimestamp}`);
            console.log(`Project deadline: ${parseInt(details.deadline)}`);
            console.log(`Amount raised: ${web3.utils.fromWei(details.amountRaised.toString(), 'ether')}`);
            console.log(`Goal: ${details.goal.toString()}`);
            console.log(`Is open: ${details.isOpen}`);

            if (currentTimestamp > parseInt(details.deadline) && parseFloat(amountRaisedInEth) < parseFloat(details.goal) && details.isOpen) {
                console.log(`Triggering refundAll for project: ${projectAddress}`);
                await projectContract.methods.closeProject().send({ from: details.owner, gas: 3000000 });
                console.log(`Project ${projectAddress} closed.`);
            }
        }));
    } catch (error) {
        console.error("Error checking projects:", error);
    }
}

setInterval(checkProjects, 5 * 1000); // Every 5 seconds
checkProjects();

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
}

run();