import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import {
  parseEther,
  ZeroAddress,
  randomBytes,
  hexlify,
  solidityPackedKeccak256,
  id,
  getAddress,
  zeroPadValue,
  AbiCoder,
  keccak256,
} from "ethers";
import {
  ParabolUSD,
  Denylister,
  ParabolUSD__factory,
  SmartAccount,
} from "../typechain-types";
import {
  signERC20Permit,
  signTransferWithAuthorization,
  signReceiveWithAuthorization,
  signBurnWithAuthorization,
  signCancelAuthorization,
} from "./helpers/erc20Signature";
// import loadFixtures
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  deployDenylister,
  deployParabolUSD,
} from "../scripts/helpers/deployScripts";
import { SignerWithAddress as Signer } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ParabolUSD Contract", function () {
  let ParabolUSDFactory: ParabolUSD__factory;

  let paraUSD: ParabolUSD;
  let paraUSDName: string;
  let paraUSDSymbol: string;
  let paraUSDVersion: string;

  let denylister: Denylister;
  let deployer: Signer;
  let admin: Signer;
  let denylistAdmin: Signer;
  let minter: Signer;
  let burner: Signer;
  let pauser: Signer;
  let user: Signer;
  let newAdmin: Signer;
  let someone: Signer;

  async function deployParabolUSDFixture(): Promise<{
    paraUSD: ParabolUSD;
    denylister: Denylister;
  }> {
    const { denylister } = await deployDenylister(
      deployer,
      denylistAdmin.address
    );
    const { paraUSD } = await deployParabolUSD(
      deployer,
      paraUSDName,
      paraUSDSymbol,
      paraUSDVersion,
      denylister.target as string,
      admin.address,
      minter.address,
      burner.address,
      pauser.address
    );
    return { paraUSD, denylister };
  }

  beforeEach(async function () {
    [
      deployer,
      admin,
      newAdmin,
      denylistAdmin,
      minter,
      burner,
      pauser,
      user,
      someone,
    ] = await ethers.getSigners();
    paraUSDName = "Parabol USD";
    paraUSDSymbol = "paraUSD";
    paraUSDVersion = "1";
    ParabolUSDFactory = await ethers.getContractFactory("ParabolUSD");
    ({ paraUSD, denylister } = await loadFixture(deployParabolUSDFixture));
  });

  describe("Deployment", function () {
    it("should set initial parameters correct", async function () {
      expect(await paraUSD.name()).to.equal(paraUSDName);
      expect(await paraUSD.symbol()).to.equal(paraUSDSymbol);
      expect(await paraUSD.decimals()).to.equal(18);
      expect(await paraUSD.totalSupply()).to.equal(0);
      expect(await paraUSD.denylister()).to.equal(denylister.target);
      expect(await paraUSD.paused()).to.be.false;
      expect(
        await paraUSD.hasRole(await paraUSD.DEFAULT_ADMIN_ROLE(), admin.address)
      ).to.be.true;
      expect(await paraUSD.denylister()).to.equal(denylister.target);
    });
    it("should revert with ZeroAddress if denylister_ is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          ParabolUSDFactory,
          [
            paraUSDName,
            paraUSDSymbol,
            paraUSDVersion,
            ZeroAddress,
            admin.address,
            minter.address,
            burner.address,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(paraUSD, "ParabolUSD__ZeroAddress");
    });
    it("should revert with ZeroAddress if admin_ is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          ParabolUSDFactory,
          [
            paraUSDName,
            paraUSDSymbol,
            paraUSDVersion,
            denylister.target,
            ZeroAddress,
            minter.address,
            burner.address,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(paraUSD, "ParabolUSD__ZeroAddress");
    });
  });

  describe("Initialization", function () {
    it("should revert with InvalidInitialization if initialized again", async function () {
      await expect(
        paraUSD.initialize(
          paraUSDName,
          paraUSDSymbol,
          paraUSDVersion,
          denylister.target,
          admin.address,
          minter.address,
          burner.address,
          pauser.address
        )
      ).to.be.revertedWithCustomError(paraUSD, "InvalidInitialization");
    });
  });

  describe("Access Control", function () {
    describe("Role: Minter", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant MINTER_ROLE", async function () {
        await expect(
          paraUSD
            .connect(admin)
            .grantRole(await paraUSD.MINTER_ROLE(), admin.address)
        )
          .to.emit(paraUSD, "RoleGranted")
          .withArgs(await paraUSD.MINTER_ROLE(), admin.address, admin.address);

        expect(
          await paraUSD.hasRole(await paraUSD.MINTER_ROLE(), admin.address)
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant MINTER_ROLE", async function () {
        await expect(
          paraUSD
            .connect(someone)
            .grantRole(await paraUSD.MINTER_ROLE(), minter.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke MINTER_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.MINTER_ROLE(), minter.address);
        await expect(
          paraUSD
            .connect(admin)
            .revokeRole(await paraUSD.MINTER_ROLE(), minter.address)
        )
          .to.emit(paraUSD, "RoleRevoked")
          .withArgs(await paraUSD.MINTER_ROLE(), minter.address, admin.address);

        expect(
          await paraUSD.hasRole(await paraUSD.MINTER_ROLE(), minter.address)
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke MINTER_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.MINTER_ROLE(), minter.address);

        await expect(
          paraUSD
            .connect(someone)
            .revokeRole(await paraUSD.MINTER_ROLE(), minter.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
        expect(
          await paraUSD.hasRole(await paraUSD.MINTER_ROLE(), minter.address)
        ).to.be.true;
      });
    });

    describe("Role: Burner", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant BURNER_ROLE", async function () {
        await expect(
          paraUSD
            .connect(admin)
            .grantRole(await paraUSD.BURNER_ROLE(), admin.address)
        )
          .to.emit(paraUSD, "RoleGranted")
          .withArgs(await paraUSD.BURNER_ROLE(), admin.address, admin.address);

        expect(
          await paraUSD.hasRole(await paraUSD.BURNER_ROLE(), admin.address)
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant BURNER_ROLE", async function () {
        await expect(
          paraUSD
            .connect(someone)
            .grantRole(await paraUSD.BURNER_ROLE(), burner.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke BURNER_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.BURNER_ROLE(), burner.address);
        await expect(
          paraUSD
            .connect(admin)
            .revokeRole(await paraUSD.BURNER_ROLE(), burner.address)
        )
          .to.emit(paraUSD, "RoleRevoked")
          .withArgs(await paraUSD.BURNER_ROLE(), burner.address, admin.address);

        expect(
          await paraUSD.hasRole(await paraUSD.BURNER_ROLE(), burner.address)
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke BURNER_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.BURNER_ROLE(), burner.address);

        await expect(
          paraUSD
            .connect(someone)
            .revokeRole(await paraUSD.BURNER_ROLE(), burner.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
        expect(
          await paraUSD.hasRole(await paraUSD.BURNER_ROLE(), burner.address)
        ).to.be.true;
      });
    });

    describe("Role: Pauser", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant PAUSER_ROLE", async function () {
        await expect(
          paraUSD
            .connect(admin)
            .grantRole(await paraUSD.PAUSER_ROLE(), admin.address)
        )
          .to.emit(paraUSD, "RoleGranted")
          .withArgs(await paraUSD.PAUSER_ROLE(), admin.address, admin.address);

        expect(
          await paraUSD.hasRole(await paraUSD.PAUSER_ROLE(), admin.address)
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant PAUSER_ROLE", async function () {
        await expect(
          paraUSD
            .connect(someone)
            .grantRole(await paraUSD.PAUSER_ROLE(), pauser.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke PAUSER_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.PAUSER_ROLE(), pauser.address);
        await expect(
          paraUSD
            .connect(admin)
            .revokeRole(await paraUSD.PAUSER_ROLE(), pauser.address)
        )
          .to.emit(paraUSD, "RoleRevoked")
          .withArgs(await paraUSD.PAUSER_ROLE(), pauser.address, admin.address);

        expect(
          await paraUSD.hasRole(await paraUSD.PAUSER_ROLE(), pauser.address)
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke PAUSER_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.PAUSER_ROLE(), pauser.address);

        await expect(
          paraUSD
            .connect(someone)
            .revokeRole(await paraUSD.PAUSER_ROLE(), pauser.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
        expect(
          await paraUSD.hasRole(await paraUSD.PAUSER_ROLE(), pauser.address)
        ).to.be.true;
      });
    });

    describe("Role: Admin", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant DEFAULT_ADMIN_ROLE", async function () {
        await expect(
          paraUSD
            .connect(admin)
            .grantRole(await paraUSD.DEFAULT_ADMIN_ROLE(), newAdmin.address)
        )
          .to.emit(paraUSD, "RoleGranted")
          .withArgs(
            await paraUSD.DEFAULT_ADMIN_ROLE(),
            newAdmin.address,
            admin.address
          );

        expect(
          await paraUSD.hasRole(
            await paraUSD.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          )
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant DEFAULT_ADMIN_ROLE", async function () {
        await expect(
          paraUSD
            .connect(someone)
            .grantRole(await paraUSD.DEFAULT_ADMIN_ROLE(), newAdmin.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke DEFAULT_ADMIN_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.DEFAULT_ADMIN_ROLE(), newAdmin.address);
        await expect(
          paraUSD
            .connect(admin)
            .revokeRole(await paraUSD.DEFAULT_ADMIN_ROLE(), newAdmin.address)
        )
          .to.emit(paraUSD, "RoleRevoked")
          .withArgs(
            await paraUSD.DEFAULT_ADMIN_ROLE(),
            newAdmin.address,
            admin.address
          );

        expect(
          await paraUSD.hasRole(
            await paraUSD.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          )
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke DEFAULT_ADMIN_ROLE", async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.DEFAULT_ADMIN_ROLE(), newAdmin.address);

        await expect(
          paraUSD
            .connect(someone)
            .revokeRole(await paraUSD.DEFAULT_ADMIN_ROLE(), newAdmin.address)
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
        expect(
          await paraUSD.hasRole(
            await paraUSD.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          )
        ).to.be.true;
      });
    });
  });

  describe("Token Operations", function () {
    beforeEach(async function () {
      await paraUSD
        .connect(admin)
        .grantRole(await paraUSD.MINTER_ROLE(), minter.address);
      await paraUSD
        .connect(admin)
        .grantRole(await paraUSD.BURNER_ROLE(), burner.address);
      await paraUSD
        .connect(admin)
        .grantRole(await paraUSD.PAUSER_ROLE(), pauser.address);
    });

    describe("Minting", function () {
      it("should mint successfully to a valid address", async function () {
        const amount = parseEther("100");
        await expect(paraUSD.connect(minter).mint(user.address, amount))
          .to.emit(paraUSD, "Mint")
          .withArgs(user.address, amount)
          .to.emit(paraUSD, "Transfer")
          .withArgs(ZeroAddress, user.address, amount);
        expect(await paraUSD.balanceOf(user.address)).to.equal(amount);
        expect(await paraUSD.totalSupply()).to.equal(amount);
      });
      it("should revert with ZeroAmount if amount is 0", async function () {
        await expect(
          paraUSD.connect(minter).mint(user.address, 0)
        ).to.be.revertedWithCustomError(paraUSD, "ParabolUSD__InvalidAmount");
      });
      it("should revert with ZeroAddress if to is 0x0", async function () {
        await expect(
          paraUSD.connect(minter).mint(ZeroAddress, parseEther("100"))
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InvalidReceiver");
      });
      it("should revert minting when the contract is paused", async function () {
        await paraUSD.connect(pauser).pause();
        await expect(
          paraUSD.connect(minter).mint(user.address, parseEther("100"))
        ).to.be.revertedWithCustomError(paraUSD, "EnforcedPause");
      });
      it("should revert minting if a user try to mint token", async function () {
        await expect(
          paraUSD.connect(user).mint(user.address, parseEther("100"))
        )
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(user.address, await paraUSD.MINTER_ROLE());
      });
    });

    describe("Burning", function () {
      it("should burner burn token's of user successfully", async function () {
        const amount = parseEther("100");
        await paraUSD.connect(minter).mint(user.address, amount);
        await paraUSD.connect(user).approve(burner.address, amount);
        await expect(paraUSD.connect(burner).burn(user.address, amount))
          .to.emit(paraUSD, "Burn")
          .withArgs(user.address, amount)
          .to.emit(paraUSD, "Transfer")
          .withArgs(user.address, ZeroAddress, amount);
        expect(await paraUSD.allowance(user.address, burner.address)).to.equal(
          0
        );
        expect(await paraUSD.balanceOf(user.address)).to.equal(0);
        expect(await paraUSD.totalSupply()).to.equal(0);
      });
      it("should burner burn own token's without allowance successfully", async function () {
        const amount = parseEther("100");
        await paraUSD.connect(minter).mint(burner.address, amount);
        await expect(paraUSD.connect(burner).burn(burner.address, amount))
          .to.emit(paraUSD, "Burn")
          .withArgs(burner.address, amount)
          .to.emit(paraUSD, "Transfer")
          .withArgs(burner.address, ZeroAddress, amount);
        expect(await paraUSD.balanceOf(burner.address)).to.equal(0);
        expect(await paraUSD.totalSupply()).to.equal(0);
      });
      it("should revert with ZeroAmount if amount is 0", async function () {
        await expect(
          paraUSD.connect(burner).burn(user.address, 0)
        ).to.be.revertedWithCustomError(paraUSD, "ParabolUSD__ZeroAmount");
      });
      it("should revert with ZeroAddress if to is 0x0", async function () {
        await expect(
          paraUSD.connect(burner).burn(ZeroAddress, parseEther("100"))
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance");
      });
      it("should revert if burner does not have enough allowance", async function () {
        const amount = parseEther("100");
        await paraUSD.connect(minter).mint(user.address, amount);
        await expect(paraUSD.connect(burner).burn(user.address, amount))
          .to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance")
          .withArgs(burner.address, 0n, amount);
      });
      it("should revert if burner does not have enough balance", async function () {
        const amount = parseEther("100");
        await expect(
          paraUSD.connect(burner).burn(user.address, amount)
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance");
      });
      it("should revert burning when the contract is paused", async function () {
        const amount = parseEther("100");
        await paraUSD.connect(minter).mint(user.address, amount);
        await paraUSD.connect(user).approve(burner.address, amount);
        await paraUSD.connect(pauser).pause();
        await expect(
          paraUSD.connect(burner).burn(user.address, amount)
        ).to.be.revertedWithCustomError(paraUSD, "EnforcedPause");
      });
      it("should revert if a user try to burn token", async function () {
        const amount = parseEther("100");
        await paraUSD.connect(minter).mint(user.address, amount);
        await expect(paraUSD.connect(user).burn(user.address, amount))
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(user.address, await paraUSD.BURNER_ROLE());
      });
    });

    describe("Pausing and Unpausing", function () {
      it("should pause the contract", async function () {
        await expect(paraUSD.connect(pauser).pause())
          .to.emit(paraUSD, "Paused")
          .withArgs(pauser.address);
        expect(await paraUSD.paused()).to.be.true;
      });
      it("should unpause the contract", async function () {
        await paraUSD.connect(pauser).pause();
        await expect(paraUSD.connect(pauser).unpause())
          .to.emit(paraUSD, "Unpaused")
          .withArgs(pauser.address);
        expect(await paraUSD.paused()).to.be.false;
      });
      it("should revert if non-pauser tries to pause", async function () {
        await expect(paraUSD.connect(someone).pause())
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.PAUSER_ROLE());
      });
      it("should revert if non-pauser tries to unpause", async function () {
        await paraUSD.connect(pauser).pause();
        await expect(paraUSD.connect(someone).unpause())
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.PAUSER_ROLE());
      });
    });

    describe("Approvals", function () {
      it("should revert if approving a denylisted spender", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          paraUSD.connect(user).approve(someone.address, parseEther("100"))
        )
          .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
          .withArgs(someone.address);
      });
      it("should revert if denylisted address approving", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          paraUSD.connect(someone).approve(user.address, parseEther("100"))
        )
          .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
          .withArgs(someone.address);
      });
      it("should revert if approving if paused", async function () {
        await paraUSD.connect(pauser).pause();
        await expect(
          paraUSD.connect(user).approve(someone.address, parseEther("100"))
        ).to.be.revertedWithCustomError(paraUSD, "EnforcedPause");
      });
      it("should approve successfully for a valid spender", async function () {
        const amount = parseEther("100");
        await expect(paraUSD.connect(user).approve(someone.address, amount))
          .to.emit(paraUSD, "Approval")
          .withArgs(user.address, someone.address, amount);
        expect(await paraUSD.allowance(user.address, someone.address)).to.equal(
          amount
        );
      });
    });

    describe("Transfers", function () {
      describe("transfer", function () {
        it("should allow transfer when not paused and addresses are not denylisted", async function () {
          const amount = parseEther("100");
          await paraUSD.connect(minter).mint(user.address, amount);
          await expect(paraUSD.connect(user).transfer(someone.address, amount))
            .to.emit(paraUSD, "Transfer")
            .withArgs(user.address, someone.address, amount);
          expect(await paraUSD.balanceOf(user.address)).to.equal(0);
          expect(await paraUSD.balanceOf(someone.address)).to.equal(amount);
        });
        it("should revert transfer from a denylisted address", async function () {
          await denylister.connect(denylistAdmin).addToDenylist(user.address);
          await expect(
            paraUSD.connect(user).transfer(someone.address, parseEther("100"))
          )
            .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
            .withArgs(user.address);
        });
        it("should revert transfer to a denylisted address", async function () {
          await denylister
            .connect(denylistAdmin)
            .addToDenylist(someone.address);
          await expect(
            paraUSD.connect(user).transfer(someone.address, parseEther("100"))
          )
            .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
            .withArgs(someone.address);
        });
        it("should revert transfer when the contract is paused", async function () {
          await paraUSD.connect(pauser).pause();
          await expect(
            paraUSD.connect(user).transfer(someone.address, parseEther("100"))
          ).to.be.revertedWithCustomError(paraUSD, "EnforcedPause");
        });
        it("should revert transfer to zero address", async function () {
          await expect(
            paraUSD.connect(user).transfer(ZeroAddress, parseEther("100"))
          ).to.be.revertedWithCustomError(paraUSD, "ERC20InvalidReceiver");
        });
        it("should revert transfer exceeding balance", async function () {
          const amount = parseEther("100");
          await expect(paraUSD.connect(user).transfer(someone.address, amount))
            .to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientBalance")
            .withArgs(
              user.address,
              await paraUSD.balanceOf(user.address),
              amount
            );
        });
      });
      describe("transferFrom", function () {
        it("should allow transferFrom when not paused and addresses are not denylisted", async function () {
          const amount = parseEther("100");
          await paraUSD.connect(minter).mint(user.address, amount);
          await paraUSD.connect(user).approve(someone.address, amount);
          await expect(
            paraUSD
              .connect(someone)
              .transferFrom(user.address, someone.address, amount)
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(user.address, someone.address, amount);
          expect(await paraUSD.balanceOf(user.address)).to.equal(0);
          expect(await paraUSD.balanceOf(someone.address)).to.equal(amount);
        });
        it("should revert transferFrom if msg.sender is denylisted", async function () {
          await denylister
            .connect(denylistAdmin)
            .addToDenylist(someone.address);
          await expect(
            paraUSD
              .connect(someone)
              .transferFrom(user.address, someone.address, parseEther("100"))
          )
            .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
            .withArgs(someone.address);
        });
        it("should revert transferFrom if from address is denylisted", async function () {
          await denylister.connect(denylistAdmin).addToDenylist(user.address);
          await expect(
            paraUSD
              .connect(someone)
              .transferFrom(user.address, someone.address, parseEther("100"))
          )
            .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
            .withArgs(user.address);
        });
        it("should revert transferFrom if to address is denylisted", async function () {
          await denylister.connect(denylistAdmin).addToDenylist(user.address);
          await expect(
            paraUSD
              .connect(someone)
              .transferFrom(someone.address, user.address, parseEther("100"))
          )
            .to.be.revertedWithCustomError(paraUSD, "ParabolUSD__Denylisted")
            .withArgs(user.address);
        });
      });
    });
  });

  describe("Permit and Auth", function () {
    describe("Permit", function () {
      it("should return correct DOMAIN_SEPERATOR", async function () {
        const typeHash = id(
          "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        const nameHash = id(paraUSDName);
        const versionHash = id(paraUSDVersion);
        const chainId = await network.provider.send("eth_chainId");
        const verifyingContract = getAddress(
          paraUSD.target as string
        ).toLowerCase();
        const verifyingContractPadded = zeroPadValue(verifyingContract, 32);

        const domainSeperator = solidityPackedKeccak256(
          ["bytes32", "bytes32", "bytes32", "uint256", "bytes32"],
          [typeHash, nameHash, versionHash, chainId, verifyingContractPadded]
        );
        expect(await paraUSD.DOMAIN_SEPARATOR()).to.equal(domainSeperator);
      });
      it("should return correct DOMAIN_SEPERATOR", async function () {
        const typeHash = id(
          "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        const nameHash = id(paraUSDName);
        const versionHash = id(paraUSDVersion);
        const chainId = await network.provider.send("eth_chainId");
        const verifyingContract = getAddress(
          paraUSD.target as string
        ).toLowerCase();

        const domainSeperator = keccak256(
          new AbiCoder().encode(
            ["bytes32", "bytes32", "bytes32", "uint256", "address"],
            [typeHash, nameHash, versionHash, chainId, verifyingContract]
          )
        );
        expect(await paraUSD.DOMAIN_SEPARATOR()).to.equal(domainSeperator);
      });
      it("should allow a valid permit", async function () {
        const value = parseEther("1000");
        const deadline = (await time.latest()) + 60; // 1 minute from now
        const nonce = Number(await paraUSD.nonces(user.address));

        const permitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          someone.address,
          value,
          nonce,
          deadline
        );

        await expect(
          paraUSD.permit(
            user.address,
            someone.address,
            value,
            deadline,
            permitSignature.v,
            permitSignature.r,
            permitSignature.s
          )
        )
          .to.emit(paraUSD, "Approval")
          .withArgs(user.address, someone.address, value);
        expect(await paraUSD.nonces(user.address)).to.equal(nonce + 1);
      });
      it("should allow a valid permit for smart account", async function () {
        const smartAccount = (await (
          await ethers.getContractFactory("SmartAccount")
        ).deploy(user.address)) as SmartAccount;

        const value = parseEther("1000");
        const deadline = (await time.latest()) + 60; // 1 minute from now
        const nonce = Number(
          await paraUSD.nonces(smartAccount.target as string)
        );

        const permitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          smartAccount.target as string,
          someone.address,
          value,
          nonce,
          deadline,
          user
        );

        await expect(
          paraUSD.permit(
            smartAccount.target as string,
            someone.address,
            value,
            deadline,
            permitSignature.v,
            permitSignature.r,
            permitSignature.s
          )
        )
          .to.emit(paraUSD, "Approval")
          .withArgs(smartAccount.target, someone.address, value);
        expect(await paraUSD.nonces(smartAccount.target)).to.equal(nonce + 1);
      });
      it("should revert permit with wrong nonce", async function () {
        const value = parseEther("1000");
        const deadline = (await time.latest()) + 60; // 1 minute ago
        const nonce = Number(await paraUSD.nonces(user.address)) + 1;

        const permitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          someone.address,
          value,
          nonce,
          deadline
        );

        await expect(
          paraUSD.permit(
            user.address,
            someone.address,
            value,
            deadline,
            permitSignature.v,
            permitSignature.r,
            permitSignature.s
          )
        ).to.be.revertedWithCustomError(paraUSD, "ERC20Base__InvalidSigner");
      });
      it("should revert permit with expired deadline", async function () {
        const value = parseEther("1000");
        const deadline = (await time.latest()) - 60; // 1 minute ago
        const nonce = Number(await paraUSD.nonces(await deployer.getAddress()));

        const permitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          someone.address,
          value,
          nonce,
          deadline
        );

        await expect(
          paraUSD.permit(
            user.address,
            someone.address,
            value,
            deadline,
            permitSignature.v,
            permitSignature.r,
            permitSignature.s
          )
        )
          .to.be.revertedWithCustomError(paraUSD, "ERC2612ExpiredSignature")
          .withArgs(deadline);
      });
    });

    describe("Auth", function () {
      let value: bigint;
      beforeEach(async function () {
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.MINTER_ROLE(), minter.address);
        await paraUSD
          .connect(admin)
          .grantRole(await paraUSD.BURNER_ROLE(), burner.address);

        value = parseEther("1000");
        await paraUSD.connect(minter).mint(user.address, value);
      });

      describe("Transfer With Authorization", function () {
        it("should allow a valid transfer with authorization", async function () {
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD.transferWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(user.address, someone.address, value);

          expect(await paraUSD.balanceOf(user.address)).to.equal(0);
          expect(await paraUSD.balanceOf(someone.address)).to.equal(value);
          expect(await paraUSD.authorizationState(user.address, nonce)).to.be
            .true;
        });
        it("should allow a valid transfer with authorization for smart account", async function () {
          const smartAccount = (await (
            await ethers.getContractFactory("SmartAccount")
          ).deploy(user.address)) as SmartAccount;
          await paraUSD.connect(minter).mint(smartAccount.target, value);
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            smartAccount.target as string,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce,
            user
          );

          await expect(
            paraUSD.transferWithAuthorization(
              smartAccount.target as string,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(smartAccount.target, someone.address, value);

          expect(await paraUSD.balanceOf(smartAccount.target)).to.equal(0);
          expect(await paraUSD.balanceOf(someone.address)).to.equal(value);
          expect(await paraUSD.authorizationState(smartAccount.target, nonce))
            .to.be.true;
        });
        it("should revert transfer before validAfter", async function () {
          const validAfter = (await time.latest()) + 60; // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD.transferWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthNotYetValid"
            )
            .withArgs(validAfter);
        });
        it("should revert transfer after validBefore", async function () {
          const validAfter = (await time.latest()) - 60; // 1 minute ago
          const validBefore = validAfter + 60; // 2 minutes ago
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD.transferWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.be.revertedWithCustomError(paraUSD, "ERC20Auth__AuthExpired")
            .withArgs(validBefore);
        });
        it("should revert transfer if auth is used", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await paraUSD.transferWithAuthorization(
            user.address,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce,
            authorizationSignature.v,
            authorizationSignature.r,
            authorizationSignature.s
          );

          await expect(
            paraUSD.transferWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(user.address, nonce);
        });
      });

      describe("Receive With Authorization", function () {
        it("should allow a valid receive with authorization", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signReceiveWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(someone)
              .receiveWithAuthorization(
                user.address,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(user.address, someone.address, value);

          expect(await paraUSD.balanceOf(user.address)).to.equal(0);
          expect(await paraUSD.balanceOf(someone.address)).to.equal(value);
          expect(await paraUSD.authorizationState(user.address, nonce)).to.be
            .true;
        });
        it("should allow a valid receive with authorization for smart account", async function () {
          const smartAccount = (await (
            await ethers.getContractFactory("SmartAccount")
          ).deploy(user.address)) as SmartAccount;
          await paraUSD.connect(minter).mint(smartAccount.target, value);
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signReceiveWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            smartAccount.target as string,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce,
            user
          );

          await expect(
            paraUSD
              .connect(someone)
              .receiveWithAuthorization(
                smartAccount.target,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(smartAccount.target, someone.address, value);

          expect(await paraUSD.balanceOf(smartAccount.target)).to.equal(0);
          expect(await paraUSD.balanceOf(someone.address)).to.equal(value);
          expect(await paraUSD.authorizationState(smartAccount.target, nonce))
            .to.be.true;
        });
        it("should revert transfer before validAfter", async function () {
          const validAfter = (await time.latest()) + 60; // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signReceiveWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(someone)
              .receiveWithAuthorization(
                user.address,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthNotYetValid"
            )
            .withArgs(validAfter);
        });
        it("should revert transfer after validBefore", async function () {
          const validAfter = (await time.latest()) - 60; // 1 minute ago
          const validBefore = validAfter + 60; // 2 minutes ago
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signReceiveWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(someone)
              .receiveWithAuthorization(
                user.address,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(paraUSD, "ERC20Auth__AuthExpired")
            .withArgs(validBefore);
        });
        it("should revert if the receiver does not the caller", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signReceiveWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(user)
              .receiveWithAuthorization(
                user.address,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(paraUSD, "ERC20Auth__InvalidCaller")
            .withArgs(user.address, someone.address);
        });
        it("should revert transfer if auth is used", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signReceiveWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await paraUSD
            .connect(someone)
            .receiveWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            );

          await expect(
            paraUSD.connect(someone).transferWithAuthorization(
              // to make sure the auth cannot be used for transfer if used for receive
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(user.address, nonce);
        });
      });

      describe("Burn With Authorization", function () {
        it("should allow a valid burn with authorization", async function () {
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            burner.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(burner)
              .burnWithAuthorization(
                user.address,
                burner.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(user.address, ZeroAddress, value)
            .to.emit(paraUSD, "Burn")
            .withArgs(user.address, value);

          expect(await paraUSD.balanceOf(user.address)).to.equal(0);
          expect(await paraUSD.totalSupply()).to.equal(0);
          expect(await paraUSD.authorizationState(user.address, nonce)).to.be
            .true;
        });
        it("should allow a valid burn with authorization for smart account", async function () {
          const smartAccount = (await (
            await ethers.getContractFactory("SmartAccount")
          ).deploy(user.address)) as SmartAccount;
          await paraUSD.connect(minter).mint(smartAccount.target, value);
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            smartAccount.target as string,
            burner.address,
            value,
            validAfter,
            validBefore,
            nonce,
            user
          );

          await expect(
            paraUSD
              .connect(burner)
              .burnWithAuthorization(
                smartAccount.target,
                burner.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.emit(paraUSD, "Transfer")
            .withArgs(smartAccount.target, ZeroAddress, value)
            .to.emit(paraUSD, "Burn")
            .withArgs(smartAccount.target, value);

          expect(await paraUSD.balanceOf(smartAccount.target)).to.equal(0);
          expect(await paraUSD.authorizationState(smartAccount.target, nonce))
            .to.be.true;
        });
        it("should revert burn before validAfter", async function () {
          const validAfter = (await time.latest()) + 60; // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            burner.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(burner)
              .burnWithAuthorization(
                user.address,
                burner.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthNotYetValid"
            )
            .withArgs(validAfter);
        });
        it("should revert burn after validBefore", async function () {
          const validAfter = (await time.latest()) - 60; // 1 minute ago
          const validBefore = validAfter + 60; // 2 minutes ago
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            burner.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(burner)
              .burnWithAuthorization(
                user.address,
                burner.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(paraUSD, "ERC20Auth__AuthExpired")
            .withArgs(validBefore);
        });
        it("should revert if the burner does not the caller", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(burner)
              .burnWithAuthorization(
                user.address,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(paraUSD, "ERC20Auth__InvalidCaller")
            .withArgs(burner.address, someone.address);
        });
        it("should revert if the burner does have the BURNER_ROLE", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await expect(
            paraUSD
              .connect(someone)
              .burnWithAuthorization(
                user.address,
                someone.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "AccessControlUnauthorizedAccount"
            )
            .withArgs(someone.address, await paraUSD.BURNER_ROLE());
        });
        it("should revert burn if auth is used", async function () {
          const validAfter = await time.latest(); // 1 minute from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signBurnWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            burner.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          await paraUSD
            .connect(burner)
            .burnWithAuthorization(
              user.address,
              burner.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            );

          await expect(
            paraUSD
              .connect(burner)
              .burnWithAuthorization(
                user.address,
                burner.address,
                value,
                validAfter,
                validBefore,
                nonce,
                authorizationSignature.v,
                authorizationSignature.r,
                authorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(user.address, nonce);
        });
      });

      describe("Cancel Authorization", function () {
        it("should allow cancellation of unused authorization", async function () {
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));
          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );
          const cancelAuthorizationSignature = await signCancelAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            nonce
          );
          await expect(
            paraUSD
              .connect(someone)
              .cancelAuthorization(
                user.address,
                nonce,
                cancelAuthorizationSignature.v,
                cancelAuthorizationSignature.r,
                cancelAuthorizationSignature.s
              )
          )
            .to.emit(paraUSD, "AuthorizationCanceled")
            .withArgs(user.address, nonce);

          expect(await paraUSD.authorizationState(user.address, nonce)).to.be
            .true;

          await expect(
            paraUSD.transferWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(user.address, nonce);
        });

        it("should allow cancellation of unused authorization for smart account", async function () {
          const smartAccount = (await (
            await ethers.getContractFactory("SmartAccount")
          ).deploy(user.address)) as SmartAccount;
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            smartAccount.target as string,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce,
            user
          );
          const cancelAuthorizationSignature = await signCancelAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            smartAccount.target as string,
            nonce,
            user
          );
          await expect(
            paraUSD
              .connect(someone)
              .cancelAuthorization(
                smartAccount.target,
                nonce,
                cancelAuthorizationSignature.v,
                cancelAuthorizationSignature.r,
                cancelAuthorizationSignature.s
              )
          )
            .to.emit(paraUSD, "AuthorizationCanceled")
            .withArgs(smartAccount.target, nonce);

          expect(await paraUSD.authorizationState(smartAccount.target, nonce))
            .to.be.true;

          await expect(
            paraUSD.transferWithAuthorization(
              smartAccount.target,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(smartAccount.target, nonce);
        });

        it("should revert cancellation of already used authorization", async function () {
          const validAfter = await time.latest(); // from now
          const validBefore = validAfter + 60; // 2 minutes from now
          const nonce = hexlify(randomBytes(32));

          const authorizationSignature = await signTransferWithAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            someone.address,
            value,
            validAfter,
            validBefore,
            nonce
          );

          const cancelAuthorizationSignature = await signCancelAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            nonce
          );

          await paraUSD
            .connect(someone)
            .transferWithAuthorization(
              user.address,
              someone.address,
              value,
              validAfter,
              validBefore,
              nonce,
              authorizationSignature.v,
              authorizationSignature.r,
              authorizationSignature.s
            );

          await expect(
            paraUSD
              .connect(user)
              .cancelAuthorization(
                user.address,
                nonce,
                cancelAuthorizationSignature.v,
                cancelAuthorizationSignature.r,
                cancelAuthorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(user.address, nonce);
        });

        it("should revert cancellation of already canceled authorization", async function () {
          const nonce = hexlify(randomBytes(32));

          const cancelAuthorizationSignature = await signCancelAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            user,
            nonce
          );

          await paraUSD
            .connect(user)
            .cancelAuthorization(
              user.address,
              nonce,
              cancelAuthorizationSignature.v,
              cancelAuthorizationSignature.r,
              cancelAuthorizationSignature.s
            );

          await expect(
            paraUSD
              .connect(user)
              .cancelAuthorization(
                user.address,
                nonce,
                cancelAuthorizationSignature.v,
                cancelAuthorizationSignature.r,
                cancelAuthorizationSignature.s
              )
          )
            .to.be.revertedWithCustomError(
              paraUSD,
              "ERC20Auth__AuthUsedOrCanceled"
            )
            .withArgs(user.address, nonce);
        });

        it("should revert if attempting to cancel an authorization from a different authorizer", async function () {
          const nonce = hexlify(randomBytes(32));

          const cancelAuthorizationSignature = await signCancelAuthorization(
            paraUSD.target as string,
            paraUSDName,
            paraUSDVersion,
            someone,
            nonce
          );

          await expect(
            paraUSD
              .connect(someone)
              .cancelAuthorization(
                user.address,
                nonce,
                cancelAuthorizationSignature.v,
                cancelAuthorizationSignature.r,
                cancelAuthorizationSignature.s
              )
          ).to.be.revertedWithCustomError(paraUSD, "ERC20Base__InvalidSigner");
          //cannot know the recovered address because the signature is invalid
        });
      });
    });
  });

  describe("Update Contract Functions", function () {
    describe("updateDenylister", function () {
      it("should revert with ZeroAddress if newDenylist is zero address", async function () {
        await expect(
          paraUSD.connect(admin).updateDenylister(ZeroAddress)
        ).to.be.revertedWithCustomError(paraUSD, "ParabolUSD__ZeroAddress");
      });
      it("should update the denylister address", async function () {
        const prevDenylister = denylister.target;
        ({ denylister } = await deployDenylister(
          deployer,
          denylistAdmin.address
        ));
        expect(await paraUSD.denylister()).to.equal(prevDenylister);
        expect(denylister.target).to.not.equal(prevDenylister);
        await expect(paraUSD.connect(admin).updateDenylister(denylister.target))
          .to.emit(paraUSD, "DenylisterUpdated")
          .withArgs(denylister.target);
      });
      it("should revert if someone tries to update the denylister address", async function () {
        await expect(paraUSD.connect(someone).updateDenylister(ZeroAddress))
          .to.be.revertedWithCustomError(
            paraUSD,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(someone.address, await paraUSD.DEFAULT_ADMIN_ROLE());
      });
    });
  });
});
