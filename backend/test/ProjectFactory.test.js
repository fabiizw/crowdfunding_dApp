const ProjectFactory = artifacts.require("ProjectFactory.sol");
const Project = artifacts.require("Project.sol");
const UserFactory = artifacts.require("UserFactory.sol");

// Helper module that can collect events from solidity
const truffleAssert = require("truffle-assertions");

/**
 *  Helper function that gets an account's current balance
 *  Functions were taken from:
 *  https://ethereum.stackexchange.com/questions/4027/how-do-you-get-the-balance-of-an-account-using-truffle-ether-pudding
 */
const promisify = (inner) =>
    new Promise((resolve, reject) =>
        inner((err, res) => {
            if (err) { reject(err) }
        resolve(res);
      })
    );

const getBalance = (account, at) =>
    promisify(cb => web3.eth.getBalance(account, at, cb));

/**
 *  Helper function to retrieve and calculate total gas cost
 *
 *  Collects gasPrice and gasUsed from the transaction so that we can get the final value
 *
 *  Method referenced from:
 *  https://ethereum.stackexchange.com/questions/41858/transaction-gas-cost-in-truffle-test-case
 *  https://ethereum.stackexchange.com/questions/42950/how-to-get-the-transaction-cost-in-a-truffle-unit-test
 */
async function calculateGasCost(txInfo) {
    // Obtain gas used and convert to BN
    const gasUsed = web3.utils.toBN(txInfo.receipt.gasUsed);
    // console.log(`GasUsed: ${txInfo.receipt.gasUsed}`);

    // Obtain gas price
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasPrice = web3.utils.toBN(tx.gasPrice);
    // console.log(`GasPrice: ${tx.gasPrice}`);

    // console.log(`gasPrice * gasUsed = ${gasPrice.mul(gasUsed)}`);

    return parseInt(gasPrice.mul(gasUsed));
}

/**
 *  Integration test for ProjectFactory.
 *
 *  If network is specified in truffle-config.js,
 *  then contract has to be deployed.
 *  Do `ganache-cli`
 *  `truffle migrate`
 *  `truffle test`
 */
contract('ProjectFactory', accounts => {
    // Setup 2 accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];
    const accountThree = accounts[2];

    let UserFactoryInstance
    let ProjectFactoryInstance
    let projectInstance

    beforeEach("Setup Contracts", async function() {
        UserFactoryInstance = await UserFactory.deployed();
        ProjectFactoryInstance = await ProjectFactory.deployed(UserFactoryInstance.address);
    });

    describe("Testing Contributions", () => {
        it("Make contributions and release collected funds", async () => {
            // The IPFS String is a web url used in app.js, so has no importance
            // here except to verify that it is specified under a project.
            const ipfsStr = "random String";
            const goal = 100;
            // duration in minutes
            const duration = 1;
            // const duration = 0.03; // 1.8 seconds

            // msg.sender for contract interaction defaults to accounts[0], so I will use accountTwo
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(ipfsStr, goal, duration, {from: accountTwo});

            let projectAddress;

            // Get projectAddress through event receipt
            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                // return ev.owner === accountTwo && web3.utils.hexToUtf8(ev.ipfsURL) === ipfsStr;
                return ev.owner === accountTwo && ev.ipfsURL === ipfsStr;
            });

            // Get project instance through projectAddress
            let projectInstance = await Project.at(projectAddress);

            // Get the initial balance of the owner of the project
            const initialOwnerFunds = parseInt(web3.utils.fromWei((await getBalance(accountTwo)).toString()));
            // const initialOwnerFunds = web3.utils.toBN(await getBalance(accountTwo));

            await projectInstance.contribute({from: accountOne, value: web3.utils.toWei((goal/2).toString(), 'ether')})
            await projectInstance.contribute({from: accountThree, value: web3.utils.toWei((goal/2).toString(), 'ether')})

            // Release the contributed funds and get transaction info
            const txInfo = await projectInstance.releaseFunds({from: accountTwo});

            // Get owner's final balance
            // let finalOwnerFunds = await getBalance(accountTwo);
            let finalOwnerFunds = parseInt(web3.utils.fromWei((await getBalance(accountTwo)).toString()));

            // Initially thought gasCost would be subtracted from the owner's balance after calling releaseFunds
            // However, testing has showed it did not happen
            // const gasCost = await calculateGasCost(txInfo);
            // Calculate owner's final balance after accounting for gas costs
            // finalOwnerFunds = finalOwnerFunds + gasCost;

            assert.equal(finalOwnerFunds - initialOwnerFunds, goal, "Owner should have received the amount stated by the goal");
        });

        it("Project is closed", async () => {
            const ipfsStr = "project 1.1";
            const goal = web3.utils.toBN(1);
            const duration = 1;

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(ipfsStr, goal, duration);

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            // Close the project
            await projectInstance.closeProject();

            // Check for error if accountTwo tries to contribute
            await truffleAssert.reverts(
                projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(1)}),
                "Project is not open for contributions."
            );
        });

        // it("Funding period has ended", async () => {
        //     const ipfsStr = "project 1.2";
        //     const goal = web3.utils.toBN(1);
        //     const duration = 1;

        //     // Create the project through accountOne
        //     const projectReceipt = await ProjectFactoryInstance.
        //                                 createProject(ipfsStr, goal, duration);

        //     let projectAddress;

        //     truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
        //         projectAddress = ev.projectAddress;
        //         return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
        //     });

        //     projectInstance = await Project.at(projectAddress);

        //     //Mock a delay
        //     expect(setTimeout).toHaveBeenCalledTimes(1);
        //     expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60000);

        //     // Check for error after mocked delay
        //     await truffleAssert.reverts(
        //         projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(0)}),
        //         "The funding period for this project has ended."
        //     );

        // });

        it("0 amount contributed", async () => {
            const ipfsStr = "project 1.3";
            const goal = web3.utils.toBN(1);
            const duration = 1;

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(ipfsStr, goal, duration);

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            // Check for error if accountTwo tries to contribute 0
            await truffleAssert.reverts(
                projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(0)}),
                "Contribution amount must be greater than zero."
            );
        });

    });

    describe("Release funds fail", () => {
        it("Function call not by owner", async () => {
            const ipfsStr = "project 2.1";
            const goal = web3.utils.toBN(1);
            const duration = 1;

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(ipfsStr, goal, duration);

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            await projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(1)})

            // Check to see that an error was thrown if accountTwo tries to release the funds
            await truffleAssert.reverts(
                projectInstance.releaseFunds({from: accountTwo}),
                "Only the project owner can release funds."
            );
        });

        it("Funding goal was not met", async () => {
            const ipfsStr = "project 2.2";
            const goal = web3.utils.toBN(2);
            const duration = 1;

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(ipfsStr, goal, duration);

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            await projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(1)})

            // Check to see that an error was thrown if accountTwo tries to release the funds
            await truffleAssert.reverts(
                projectInstance.releaseFunds(),
                "Funding goal has not been reached."
            );
        });

        it("Project has been closed", async () => {
            const ipfsStr = "project 2.3";
            const goal = web3.utils.toBN(2);
            const duration = 1;

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(ipfsStr, goal, duration);

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            // await projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(1)})

            // Close the project
            await projectInstance.closeProject();

            // Check to see that an error was thrown if accountTwo tries to release the funds
            await truffleAssert.reverts(
                projectInstance.releaseFunds(),
                "Funding goal has not been reached."
            );
        });
    });

    it("refundAll successfully returns contributions", async () => {
        const ipfsStr = "project 3.1";
        const goal = 10;
        const duration = 1;

        // Create the project through accountOne
        const projectReceipt = await ProjectFactoryInstance.
                                createProject(ipfsStr, goal, duration);

        let projectAddress;

        truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
            projectAddress = ev.projectAddress;
            return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
        });

        projectInstance = await Project.at(projectAddress);

        // Get initial balance of two accounts
        const initAccTwoBal = parseInt(await getBalance(accountTwo));
        const initAccThreeBal = parseInt(await getBalance(accountThree));

        // Call contribute with previous two accounts
        // Collect their receipts to calculate their gasCost
        const txInfoTwo = await projectInstance.contribute({from: accountTwo, value: web3.utils.toBN(2)})
        const txInfoThree = await projectInstance.contribute({from: accountThree, value: web3.utils.toBN(2)})

        // Get gasCost for both accounts
        const gasCostTwo = await calculateGasCost(txInfoTwo);
        const gasCostThree = await calculateGasCost(txInfoThree);

        // Call the function to close the project,
        // which will call refundAll and refund everyone
        await projectInstance.closeProject();

        // Get final balance of the two accounts
        const finalAccTwoBal = parseInt(await getBalance(accountTwo));
        const finalAccThreeBal = parseInt(await getBalance(accountThree));

        // Assert that both accounts' final values are equal to intial values
        // Account for gasCost by doing final+gasCost
        assert.equal(finalAccTwoBal + gasCostTwo,
             initAccTwoBal,
             "Account Two should have received their contributed funds after refundAll");

        assert.equal(finalAccThreeBal + gasCostThree,
             initAccThreeBal,
             "Account Two should have received their contributed funds after refundAll");

    });

    // afterEach(async () => {
    //     // await projectInstance.closeProject();
    // });
});
