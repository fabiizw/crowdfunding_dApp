const express = require('express'); 
const {Web3} = require('web3'); 
const MyContract = require("./build/contracts/MyContract.json"); 
const contractABI = MyContract.abi; 
const contractAddress = '0x0a6dA2D7991158Bc62E30aFD3971a4bA18fF41C1'; //always replace this
const rpcEndpoint = 'http://127.0.0.1:8545';
  
const app = express(); 
const web3 = new Web3(new Web3.providers.HttpProvider(rpcEndpoint)); 
  
const contract = new web3.eth.Contract(contractABI, contractAddress); 
  
app.use(express.json()); 
  
app.get('/number', async (req, res) => { 
    const number = await contract.methods.getNumber().call(); 
    res.json({ number: number.toString() }); 
}); 
  
app.listen(3000, () => { 
  console.log('Server listening on port 3000'); 
});