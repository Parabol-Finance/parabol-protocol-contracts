import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { Denylister, Denylister__factory } from "../typechain-types";
import { deployDenylister } from "../scripts/helpers/deployScripts";
import { SignerWithAddress as Signer } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Denylister Contract", function () {
  let DenylisterFactory: Denylister__factory;
  let denylister: Denylister;
  let deployer: Signer;
  let denylistAdmin: Signer;
  let someone: Signer;
  let someone2: Signer;
  let someone3: Signer;

  async function deployDenylisterFixture(): Promise<{
    denylister: Denylister;
  }> {
    const { denylister } = await deployDenylister(
      deployer,
      denylistAdmin.address
    );

    return { denylister };
  }

  beforeEach(async function () {
    DenylisterFactory = await ethers.getContractFactory("Denylister");
    [deployer, denylistAdmin, someone, someone2, someone3] =
      await ethers.getSigners();
    ({ denylister } = await loadFixture(deployDenylisterFixture));
  });

  describe("Deployment", function () {
    it("should set initial parameters correct", async function () {
      expect(await denylister.owner()).to.equal(denylistAdmin.address);
    });
    it("should revert with ZeroAddress if denylistAdmin is zero address", async function () {
      await expect(
        upgrades.deployProxy(DenylisterFactory, [ZeroAddress], {
          initializer: "initialize",
        })
      ).to.be.revertedWithCustomError(denylister, "Denylister__ZeroAddress");
    });
  });

  describe("Initialization", function () {
    it("should revert with InvalidInitialization if initialized again", async function () {
      await expect(
        denylister.connect(denylistAdmin).initialize(denylistAdmin.address)
      ).to.be.revertedWithCustomError(denylister, "InvalidInitialization");
    });
  });
  describe("Denylisting", function () {
    it("should add to denylist", async function () {
      await expect(
        denylister.connect(denylistAdmin).addToDenylist(someone.address)
      )
        .to.emit(denylister, "AddedToDenylist")
        .withArgs(someone.address);
      expect(await denylister.isDenylisted(someone.address)).to.be.true;
    });

    it("should revert if try to add same address to denylist", async function () {
      await denylister.connect(denylistAdmin).addToDenylist(someone.address);
      await expect(
        denylister.connect(denylistAdmin).addToDenylist(someone.address)
      )
        .to.be.revertedWithCustomError(
          denylister,
          "Denylister__AlreadyAddedToDenylist"
        )
        .withArgs(someone.address);
    });

    it("should revert if try to add zero address to denylist", async function () {
      await expect(
        denylister.connect(denylistAdmin).addToDenylist(ZeroAddress)
      ).to.be.revertedWithCustomError(denylister, "Denylister__ZeroAddress");
    });

    it("should batch add to denylist", async function () {
      await expect(
        denylister
          .connect(denylistAdmin)
          .batchAddToDenylist([
            someone.address,
            someone2.address,
            someone3.address,
          ])
      )
        .to.emit(denylister, "AddedToDenylist")
        .withArgs(someone.address)
        .to.emit(denylister, "AddedToDenylist")
        .withArgs(someone2.address)
        .to.emit(denylister, "AddedToDenylist")
        .withArgs(someone3.address);
      expect(await denylister.isDenylisted(someone.address)).to.be.true;
      expect(await denylister.isDenylisted(someone2.address)).to.be.true;
      expect(await denylister.isDenylisted(someone3.address)).to.be.true;
    });

    it("should revert if try to add duplicated address as batch to denylist", async function () {
      await expect(
        denylister
          .connect(denylistAdmin)
          .batchAddToDenylist([someone.address, someone.address])
      )
        .to.be.revertedWithCustomError(
          denylister,
          "Denylister__AlreadyAddedToDenylist"
        )
        .withArgs(someone.address);
    });

    it("should revert if non owner try to add to denylist", async function () {
      await expect(denylister.connect(someone).addToDenylist(someone.address))
        .to.be.revertedWithCustomError(denylister, "OwnableUnauthorizedAccount")
        .withArgs(someone.address);
    });
  });

  describe("Removing from Denylist", function () {
    beforeEach(async function () {
      await denylister
        .connect(denylistAdmin)
        .batchAddToDenylist([
          someone.address,
          someone2.address,
          someone3.address,
        ]);
    });
    it("should remove from denylist", async function () {
      await expect(
        denylister.connect(denylistAdmin).removeFromDenylist(someone.address)
      )
        .to.emit(denylister, "RemovedFromDenylist")
        .withArgs(someone.address);
      expect(await denylister.isDenylisted(someone.address)).to.be.false;
    });

    it("should revert if try to remove same address from denylist twice", async function () {
      await denylister
        .connect(denylistAdmin)
        .removeFromDenylist(someone.address);
      await expect(
        denylister.connect(denylistAdmin).removeFromDenylist(someone.address)
      )
        .to.be.revertedWithCustomError(denylister, "Denylister__NotDenylisted")
        .withArgs(someone.address);
    });

    it("should revert if try to remove zero address from denylist", async function () {
      await expect(
        denylister.connect(denylistAdmin).removeFromDenylist(ZeroAddress)
      ).to.be.revertedWithCustomError(denylister, "Denylister__ZeroAddress");
    });

    it("should batch remove from denylist", async function () {
      await expect(
        denylister
          .connect(denylistAdmin)
          .batchRemoveFromDenylist([
            someone.address,
            someone2.address,
            someone3.address,
          ])
      )
        .to.emit(denylister, "RemovedFromDenylist")
        .withArgs(someone.address)
        .to.emit(denylister, "RemovedFromDenylist")
        .withArgs(someone2.address)
        .to.emit(denylister, "RemovedFromDenylist")
        .withArgs(someone3.address);
      expect(await denylister.isDenylisted(someone.address)).to.be.false;
      expect(await denylister.isDenylisted(someone2.address)).to.be.false;
      expect(await denylister.isDenylisted(someone3.address)).to.be.false;
    });

    it("should revert if try to remove duplicated address as batch remove from denylist", async function () {
      await expect(
        denylister
          .connect(denylistAdmin)
          .batchRemoveFromDenylist([someone.address, someone.address])
      )
        .to.be.revertedWithCustomError(denylister, "Denylister__NotDenylisted")
        .withArgs(someone.address);
    });

    it("should revert if non owner try to remove from denylist", async function () {
      await expect(
        denylister.connect(someone).removeFromDenylist(someone.address)
      )
        .to.be.revertedWithCustomError(denylister, "OwnableUnauthorizedAccount")
        .withArgs(someone.address);
    });
  });
});
