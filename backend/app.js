const express = require('express');
const { Web3 } = require('web3');
const ProjectFactory = require("./build/contracts/ProjectFactory.json");
const Project = require("./build/contracts/Project.json");
const UserFactory = require("./build/contracts/UserFactory.json");
const User = require("./build/contracts/User.json");
const { ThirdwebStorage } = require("@thirdweb-dev/storage");

const storage = new ThirdwebStorage({
    secretKey: "RUB6gU43Sp357hh-y3xjR8Hp7KSauDTNIg521N8rAYfFbdvfVeSk4LR0rQU2eKF7QGMy6r5PjuD1x9Fiatp9Sg"
});

const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

const userFactoryABI = UserFactory.abi;
const userFactoryAddress = '0x3df4AE1a62cEb790E8cc9b06750cE19A95EAdfB2'; // Update this with the deployed address
const userFactoryContract = new web3.eth.Contract(userFactoryABI, userFactoryAddress);

const projectFactoryABI = ProjectFactory.abi;
const projectFactoryAddress = '0xE8e64aeF2c884a54e3a5b8FFbB2F2f5eF006661A'; // Update this with the deployed address
const projectFactoryContract = new web3.eth.Contract(projectFactoryABI, projectFactoryAddress);

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
    const { name, linkedin, twitter, bio, from } = req.body;

    try {
        const isRegistered = await isUserRegistered(from);
        if (isRegistered) {
            return res.status(403).json({ error: "User already registered." });
        }

        // Prepare user details for IPFS upload
        const userDetails = {};
        if (name) userDetails.name = name;
        if (linkedin) userDetails.linkedin = linkedin;
        if (twitter) userDetails.twitter = twitter;
        if (bio) userDetails.bio = bio;

        let ipfsURL = '';

        if (Object.keys(userDetails).length > 0) {
            // Upload user details to IPFS using Thirdweb storage
            const upload = await storage.upload(JSON.stringify(userDetails));
            ipfsURL = storage.resolveScheme(upload);
        }

        const receipt = await userFactoryContract.methods.createUser(ipfsURL).send({ from, gas: 3000000 });
        console.log(receipt);

        const balance = await web3.eth.getBalance(from);

        res.json({
            message: "User created",
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
        if (!name || !description) {
            return res.status(400).json({ error: 'Project name and description are required.' });
        }

        const isRegistered = await isUserRegistered(from);
        if (!isRegistered) {
            return res.status(403).json({ error: 'User not registered.' });
        }

        // Prepare project details for IPFS upload
        const projectDetails = { name, description };
        const upload = await storage.upload(JSON.stringify(projectDetails));
        const ipfsURL = storage.resolveScheme(upload);

        // Create project on the blockchain with the IPFS URL
        const receipt = await projectFactoryContract.methods.createProject(ipfsURL, web3.utils.toWei(goal.toString(), 'ether'), duration).send({ from, gas: 3000000 });
        console.log(receipt);

        const projectAddress = receipt.events.ProjectCreated.returnValues.projectAddress;

        res.json({
            message: 'Project created',
            from: from,
            goal: goal,
            projectAddress: projectAddress,
            ipfsURL: ipfsURL,
        });
    } catch (error) {
        console.error('Error creating project:', error);
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
    
        let offChainDetails = {};
        if (details.ipfsURL) {
          const response = await storage.download(details.ipfsURL);
          offChainDetails = await response.json();
        }

        return {
          ...cleanAndConvert(details),
          ...offChainDetails,
          balance: web3.utils.fromWei(balance.toString(), 'ether')
        };
    }));
      res.json({ users: userDetails });
    } catch (error) {
      console.error("Error fetching users:", error);
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
        details.goal = web3.utils.fromWei(details.goal, 'ether');
        details.amountRaised = web3.utils.fromWei(details.amountRaised, 'ether');
        details.deadline = formatTimestamp(parseInt(details.deadline.toString())); // Convert deadline to human-readable format

        let offChainDetails = {};
        if (details.ipfsURL) {
            const response = await fetch(details.ipfsURL);
            offChainDetails = await response.json();
        }

        return {
            ...cleanAndConvert(details),
            ...offChainDetails,
            projectAddress: projectAddress
        };
    }));
        res.json({ projects: projectDetails });
    } catch (error) {
        console.error("Error fetching projects:", error);
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

app.post('/claimRefund', async (req, res) => {
    const { projectAddress, from } = req.body;

    try {
        const isRegistered = await isUserRegistered(from);
        if (!isRegistered) {
            return res.status(403).json({ error: "User not registered." });
        }

        const projectContract = new web3.eth.Contract(Project.abi, projectAddress);
        const projectDetails = await projectContract.methods.getProjectDetails().call();

        if (projectDetails.isOpen) {
            return res.status(403).json({ error: "Project is still open." });
        }

        if (projectDetails.amountRaised >= projectDetails.goal) {
            return res.status(403).json({ error: "Funding goal has been reached, no refunds available." });
        }

        const receipt = await projectContract.methods.claimRefund().send({ from, gas: 3000000 });
        console.log(receipt);

        res.json({
            message: "Refund claimed successfully",
            projectAddress: projectAddress,
            from: from
        });
    } catch (error) {
        console.error("Error claiming refund:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/userCount', async (req, res) => {
    try {
        const userAddresses = await userFactoryContract.methods.getUsers().call();
        const userCount = userAddresses.length;

        res.json({ userCount: userCount });
    } catch (error) {
        console.error("Error fetching user count:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/projectCount', async (req, res) => {
    try {
        const projectAddresses = await projectFactoryContract.methods.getProjects().call();
        const projectCount = projectAddresses.length;

        res.json({ projectCount: projectCount });
    } catch (error) {
        console.error("Error fetching project count:", error);
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
            const goalInEth = web3.utils.fromWei(details.goal.toString(), 'ether'); // Convert goal from Wei to Ether
            // Automatically trigger refundAll if the deadline has passed

            const currentTimestamp = Math.floor(Date.now() / 1000);
        
            if (currentTimestamp > parseInt(details.deadline) && parseFloat(amountRaisedInEth) < parseFloat(goalInEth) && details.isOpen) {  
                await projectContract.methods.closeProject().send({ from: details.owner, gas: 3000000 });
            }
        }));
    } catch (error) {
        console.error("Error checking projects:", error);
    }
}

setInterval(checkProjects, 30 * 1000); // Every 30 seconds
checkProjects();

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});

