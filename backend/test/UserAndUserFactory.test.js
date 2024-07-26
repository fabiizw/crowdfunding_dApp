const UserFactory = artifacts.require("UserFactory");
const User = artifacts.require("User");

contract("UserFactory", (accounts) => {
    let userFactory;
    const user_add = [
        "0x100273548141d467ea2d1393aAe593F072Da6704",
        "0x72ec72aB75B04bbc44D26E469380bEB341aAe369",
        "0x6EFDE477F8c6e16F2D0526d6b187a6C0b952D2Fc"
    ];

    before(async () => {
        userFactory = await UserFactory.new();
    });

    it("should create and retrieve users correctly", async () => {
        let users = [];
        users.push(await User.new("James", user_add[0]));
        users.push(await User.new("Emily", user_add[1]));
        users.push(await User.new("Alice", user_add[2]));

        for (let i = 0; i < 3; i++) {
            let userInfo = await users[i].getUserInfo();
            let expectedName = ["James", "Emily", "Alice"][i];
            let expectedAddress = user_add[i];

            assert.equal(web3.utils.keccak256(userInfo.ipfsURL), web3.utils.keccak256(expectedName), `ipfsURL should be ${expectedName}`);
            assert.equal(userInfo.userAddress, expectedAddress, `Address should match ${expectedAddress}`);
        }
    });

    it("should create a single user and retrieve it", async () => {
        await userFactory.createUser("James", { from: accounts[0] });
        let userAddresses = await userFactory.getUsers();
        let userInstance = await User.at(userAddresses[0]);
        let userInfo = await userInstance.getUserInfo();

        assert.equal(web3.utils.keccak256(userInfo.ipfsURL), web3.utils.keccak256("James"), "ipfsURL should be James");
        assert.equal(userInfo.userAddress, accounts[0], "Address should match the deployer address");
    });

    it("should create a user with the second address", async () => {
        await userFactory.createUser("Emily", { from: accounts[1] });
        let userAddresses = await userFactory.getUsers();
        let userInstance = await User.at(userAddresses[1]);
        let userInfo = await userInstance.getUserInfo();

        assert.equal(web3.utils.keccak256(userInfo.ipfsURL), web3.utils.keccak256("Emily"), "ipfsURL should be Emily");
        assert.equal(userInfo.userAddress, accounts[1], "Address should match the deployer address");
    });

    it("should create a user with the third address", async () => {
        await userFactory.createUser("Alice", { from: accounts[2] });
        let userAddresses = await userFactory.getUsers();
        let userInstance = await User.at(userAddresses[2]);
        let userInfo = await userInstance.getUserInfo();

        assert.equal(web3.utils.keccak256(userInfo.ipfsURL), web3.utils.keccak256("Alice"), "ipfsURL should be Alice");
        assert.equal(userInfo.userAddress, accounts[2], "Address should match the deployer address");
    });

    it("should not allow the same address to register twice", async () => {
        try {
            await userFactory.createUser("Alice", { from: accounts[0] });
            assert.fail("Expected error not received");
        } catch (error) {
            assert(error.message.includes("User already registered"), `Expected "User already registered" but got ${error.message}`);
        }
    });
});
