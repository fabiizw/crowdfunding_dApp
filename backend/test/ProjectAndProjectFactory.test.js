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

    // Obtain gas price
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasPrice = web3.utils.toBN(tx.gasPrice);

    return gasPrice.mul(gasUsed);
}

/**
 *  Integration test for ProjectFactory.
 *
 *  If network is specified in truffle-config.js,
 *  then contract can be deployed in either networks, defaults to `development`.
 *  Do `ganache-cli`
 *  `truffle migrate`
 *  `truffle test`
 */
contract('ProjectFactory', accounts => {
    // Setup 2 accounts.
    const accountOne = accounts[0];
    let accountTwo = accounts[1];
    let accountThree = accounts[2];

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

            // msg.sender for contract interaction defaults to accounts[0], so I will use accountTwo
            const projectReceipt = await ProjectFactoryInstance.
                                        createProject(
                                            ipfsStr,
                                            web3.utils.toWei(goal.toString(), 'ether'),
                                            duration,
                                            {from: accountTwo});

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
            const initialOwnerFunds = parseInt(web3.utils.fromWei(await getBalance(accountTwo), 'ether'));
            // const initialOwnerFunds = web3.utils.toBN(await getBalance(accountTwo));

            await projectInstance.contribute({
                from: accountOne,
                value: web3.utils.toWei((goal/2).toString(), 'ether')
            });
            await projectInstance.contribute({
                from: accountThree,
                value: web3.utils.toWei((goal/2).toString(), 'ether')
            });

            // Release the contributed funds and get transaction info
            const txInfo = await projectInstance.releaseFunds({from: accountTwo});

            // Get owner's final balance
            // Converting to BigNumber provides precise numerical manipulation
            let finalOwnerFunds = web3.utils.toBN(await getBalance(accountTwo));

            /**
             *  gasCost will be subtracted from the owner's balance
             *  after calling releaseFunds.
             *  However negligible it is,
             *  it could provide incorrect calculations through rounding
             *  if we don't make such operations
             */
            const gasCost = await calculateGasCost(txInfo);
            // Calculate owner's final balance after accounting for gas costs
            finalOwnerFunds = parseInt(
                web3.utils.fromWei((finalOwnerFunds.add(gasCost)).toString(), 'ether'));

            assert.equal(
                finalOwnerFunds - initialOwnerFunds,
                goal,
                "Owner should have received the amount stated by the goal"
            );
        });

        it("Project is closed", async () => {
            const ipfsStr = "project 1.1";
            const goal = 1;
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

        it("0 amount contributed", async () => {
            const ipfsStr = "project 1.2";
            const goal = 1;
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
            const goal = 1;
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

            await projectInstance.contribute({
                from: accountTwo, value: web3.utils.toBN(1)
            });

            // Check to see that an error was thrown if accountTwo tries to release the funds
            await truffleAssert.reverts(
                projectInstance.releaseFunds({from: accountTwo}),
                "Only the project owner can release funds."
            );
        });

        it("Funding goal was not met", async () => {
            const ipfsStr = "project 2.2";
            const goal = 2;
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
            const goal = 2;
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

            // Check to see that an error was thrown if accountTwo tries to release the funds
            await truffleAssert.reverts(
                projectInstance.releaseFunds(),
                "Funding goal has not been reached."
            );
        });
    });

    describe("Testing claimRefund", () => {
        /**
         *  1. Create project
         *  2. Get balances of accTwo & accThree
         *  3. Use accTwo & accThree to transfer funds
         *  4. Check accTwo & accThree values differ
         *     from their initial ones by the amount contributed.
         *  5. Call refund with accTwo and check its final balance
         *  6. Call refund with accThree and check its final balance
         *
         */
        it("claimRefund successfully returns contributions", async () => {
            const ipfsStr = "project 3.1";
            const goal = 10;
            const duration = 1;

            // Setup variables for unused accounts
            accountTwo = accounts[3];
            accountThree = accounts[4];

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                    createProject(
                                        ipfsStr,
                                        web3.utils.toWei(goal.toString(), 'ether'),
                                        duration
                                    );

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            // Get initial balance of two accounts
            const initAccTwoBal = web3.utils.toBN(await getBalance(accountTwo));
            const initAccThreeBal = web3.utils.toBN(await getBalance(accountThree));
            const cont = "2"

            // Contribute with two accounts and collect their receipts
            // Collect their receipts to calculate their gasCost
            const contTxTwo = await projectInstance.contribute({
                from: accountTwo, value: web3.utils.toWei(cont, 'ether')
            });
            const contTxThree = await projectInstance.contribute({
                from: accountThree, value: web3.utils.toWei(cont, 'ether')
            });

            // Call contribute with previous two accounts
            // Get gasCost for both accounts
            const contCostTwo = await calculateGasCost(contTxTwo);
            const contCostThree = await calculateGasCost(contTxThree);
            const paidAccTwoBal = web3.utils.toBN(await getBalance(accountTwo));
            const paidAccThreeBal = web3.utils.toBN(await getBalance(accountThree));

            /**
             *  We need to account for gas difference, which is
             *  very negligible in this case since Wei is larger than ether.
             *  This also avoids any rounding errors.
             */
            const convertedTwoDiff = parseInt(web3.utils.fromWei(
                (initAccTwoBal.sub(paidAccTwoBal.add(contCostTwo)).toString())
            ), 'ether')
            const convertedThreeDiff = parseInt(web3.utils.fromWei(
                (initAccTwoBal.sub(paidAccThreeBal.add(contCostThree)).toString())
            ), 'ether')

            // Make sure both accounts have contributed to the project
            // Check accountTwo
            assert.equal(
                convertedTwoDiff,
                cont,
                "AccountTwo's contribution are not accurate");
            // Check accountThree
            assert.equal(
                convertedThreeDiff,
                cont,
                "AccountThree's contribution are not accurate");

            // Close the project to ensure refunds can be made.
            await projectInstance.closeProject();

            // Claim refund as accountTwo
            // Retrieve receipt to account for gas
            const refundTxTwo = await projectInstance.claimRefund({from: accountTwo});
            const refundCostTwo = await calculateGasCost(refundTxTwo);

            // Get final balance of accountTwo
            const finalAccTwoBal =
                web3.utils.toBN(await getBalance(accountTwo));

            // Calculate final balance before gas costs and convert to Ether
            const convertedTwoFinal = parseInt(web3.utils.fromWei(
                (finalAccTwoBal.
                    add(contCostTwo.
                        add(refundCostTwo)).toString())
            ), 'ether')

            // Assert that accountTwo's final value is equal to initial value
            // Account for gasCost by doing final+gasCost
            assert.equal(
                convertedTwoFinal,
                parseInt(web3.utils.fromWei(initAccTwoBal.toString(), 'ether')),
                "Account Two should have received their contributed funds after refundAll"
            );

            // Claim refund as accountThree
            // Retrieve receipt to account for gas
            const refundTxThree = await projectInstance.claimRefund({from: accountThree});
            const refundCostThree = await calculateGasCost(refundTxThree);

            // Get final balance of accountThree
            const finalAccThreeBal =
                web3.utils.toBN(await getBalance(accountThree));

            // Calculate final balance before gas costs and convert to Ether
            const convertedThreeFinal = parseInt(web3.utils.fromWei(
                (finalAccThreeBal.
                    add(contCostThree.
                        add(refundCostThree)).toString())
            ), 'ether')

            // Assert that accountThree's final value is equal to initial value
            // Account for gasCost by doing final+gasCost
            assert.equal(
                convertedThreeFinal,
                parseInt(web3.utils.fromWei(initAccThreeBal.toString(), 'ether')),
                "Account Three should have received their contributed funds after refundAll"
            );
        });

        it("Claim a refund while the project is still open", async () => {
            const ipfsStr = "project 3.2";
            const goal = 10;
            const duration = 1;

            accountTwo = accounts[3];

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                    createProject(
                                        ipfsStr,
                                        web3.utils.toWei(goal.toString(), 'ether'),
                                        duration
                                    );

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            await projectInstance.contribute({
                from: accountTwo, value: web3.utils.toWei("2", 'ether')
            });

            // Try and get the refund, a revert should occur
            await truffleAssert.reverts(
                projectInstance.claimRefund({from: accountTwo}),
                "Project is still open."
            );
        });

        it("Claim a refund if the funding goal was reached", async () => {
            const ipfsStr = "project 3.3";
            const goal = 5;
            const duration = 1;

            accountTwo = accounts[3];

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                    createProject(
                                        ipfsStr,
                                        web3.utils.toWei(goal.toString(), 'ether'),
                                        duration
                                    );

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            await projectInstance.contribute({
                from: accountTwo, value: web3.utils.toWei("5", 'ether')
            });

            // Close the project since the goal has been met
            await projectInstance.closeProject();

            // Try and claim the refund, a revert should occur
            await truffleAssert.reverts(
                projectInstance.claimRefund({from: accountTwo}),
                "Funding goal has been reached."
            );
        });

        it("Claim a refund if the user never contributed", async () => {
            const ipfsStr = "project 3.4";
            const goal = 5;
            const duration = 1;

            accountTwo = accounts[3];

            // Create the project through accountOne
            const projectReceipt = await ProjectFactoryInstance.
                                    createProject(
                                        ipfsStr,
                                        web3.utils.toWei(goal.toString(), 'ether'),
                                        duration
                                    );

            let projectAddress;

            truffleAssert.eventEmitted(projectReceipt, 'ProjectCreated', (ev) => {
                projectAddress = ev.projectAddress;
                return ev.owner == accountOne && ev.ipfsURL == ipfsStr;
            });

            projectInstance = await Project.at(projectAddress);

            await projectInstance.contribute({
                from: accountTwo, value: web3.utils.toWei("3", 'ether')
            });

            // Close the project to emulate the goal not being reached after the funding period
            await projectInstance.closeProject();

            // Try and claim the refund as accountOne, a revert should occur
            await truffleAssert.reverts(
                projectInstance.claimRefund({from: accountOne}),
                "No contributions to refund."
            );
        });
    });
});
