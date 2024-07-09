const express = require('express'); 
const {Web3} = require('web3'); 
const ProjectFactory = require("./build/contracts/ProjectFactory.json"); 
const Project = require("./build/contracts/Project.json"); 

const app = express(); 
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545')); 

const factoryABI = ProjectFactory.abi;
const factoryAddress = '0x6133B98eAB825CE8Db2EC24E1e2168495ED645D4'; // Update this with the deployed address
const factoryContract = new web3.eth.Contract(factoryABI, factoryAddress);

app.use(express.json()); 

app.post('/createProject', async (req, res) => { 
    const { name, description, goal, duration } = req.body;
    const accounts = await web3.eth.getAccounts();

    try {
        const receipt = await factoryContract.methods.createProject(name, description, goal, duration).send({ from: accounts[0], gas: 3000000 });
        console.log(receipt);
        const serializedReceipt = convertBigIntToString(receipt);
        res.json({ receipt: serializedReceipt });
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/projects', async (req, res) => { 
    const projects = await factoryContract.methods.getProjects().call();
    res.json({ projects });
}); 

/*
app.get('/project/:id', async (req, res) => {
    const projectAddress = req.params.id;
    const projectContract = new web3.eth.Contract(Project.abi, projectAddress);

    const projectDetails = await projectContract.methods.project().call();
    res.json(projectDetails);
});

app.post('/project/:id/contribute', async (req, res) => {
    const projectAddress = req.params.id;
    const { amount } = req.body;
    const accounts = await web3.eth.getAccounts();
    const projectContract = new web3.eth.Contract(Project.abi, projectAddress);

    const receipt = await projectContract.methods.contribute().send({ from: accounts[0], value: amount });
    res.json({ receipt });
});

app.post('/project/:id/releaseFunds', async (req, res) => {
    const projectAddress = req.params.id;
    const accounts = await web3.eth.getAccounts();
    const projectContract = new web3.eth.Contract(Project.abi, projectAddress);

    const receipt = await projectContract.methods.releaseFunds().send({ from: accounts[0] });
    res.json({ receipt });
});

app.post('/project/:id/refund', async (req, res) => {
    const projectAddress = req.params.id;
    const accounts = await web3.eth.getAccounts();
    const projectContract = new web3.eth.Contract(Project.abi, projectAddress);

    const receipt = await projectContract.methods.refund().send({ from: accounts[0] });
    res.json({ receipt });
});

*/
app.listen(3000, () => { 
  console.log('Server listening on port 3000'); 
});

// Helper function to convert BigInt values to strings
function convertBigIntToString(obj) {
    for (let key in obj) {
        if (typeof obj[key] === 'bigint') {
            obj[key] = obj[key].toString();
        } else if (typeof obj[key] === 'object') {
            obj[key] = convertBigIntToString(obj[key]);
        }
    }
    return obj;
}
