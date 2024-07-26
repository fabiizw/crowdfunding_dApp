const UserFactory = artifacts.require("UserFactory");
const ProjectFactory = artifacts.require("ProjectFactory");

module.exports = async function(deployer) {
    await deployer.deploy(UserFactory);
    const userFactory = await UserFactory.deployed();
    await deployer.deploy(ProjectFactory, userFactory.address);
};
