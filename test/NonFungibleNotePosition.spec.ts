import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import { parseEther, ZeroAddress, ZeroHash } from "ethers";
import {
  Denylister,
  NonFungibleNotePosition,
  INonFungibleNotePosition,
  ParabolNoteDescriptor,
} from "../typechain-types";
import {
  deployNonFungibleNotePosition,
  deployDenylister,
} from "../scripts/helpers/deployScripts";
import { SignerWithAddress as Signer } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("NonFungibleNotePosition Contract", function () {
  let nonFungibleNotePosition: NonFungibleNotePosition;
  let denylister: Denylister;
  let name: string;
  let symbol: string;
  let version: string;
  let deployer: Signer;
  let admin: Signer;
  let newAdmin: Signer;
  let denylistAdmin: Signer;
  let pauser: Signer;
  let rsp: Signer;
  let newRsp: Signer;
  let user: Signer;
  let someone: Signer;
  let someone2: Signer;
  let someone3: Signer;

  async function deployNonFungibleNotePositionFixture(): Promise<{
    nonFungibleNotePosition: NonFungibleNotePosition;
    denylister: Denylister;
  }> {
    const { denylister } = await deployDenylister(
      deployer,
      denylistAdmin.address
    );
    const { nonFungibleNotePosition } = await deployNonFungibleNotePosition(
      deployer,
      name,
      symbol,
      version,
      denylister.target as string,
      admin.address,
      pauser.address
    );
    return { nonFungibleNotePosition, denylister };
  }

  beforeEach(async function () {
    name = "NonFungibleNotePosition";
    symbol = "NFP";
    version = "1";
    [
      deployer,
      admin,
      newAdmin,

      denylistAdmin,
      pauser,
      rsp,
      newRsp,
      user,
      someone,
      someone2,
      someone3,
    ] = await ethers.getSigners();

    ({ nonFungibleNotePosition, denylister } = await loadFixture(
      deployNonFungibleNotePositionFixture
    ));
  });

  describe("Deployment", function () {
    let parabolNoteDescriptor: ParabolNoteDescriptor;
    beforeEach(async function () {
      const dateTime = await (
        await ethers.getContractFactory("DateTime")
      ).deploy();
      const parabolNoteSVG = await (
        await ethers.getContractFactory("ParabolNoteSVG")
      ).deploy();
      parabolNoteDescriptor = await (
        await ethers.getContractFactory("ParabolNoteDescriptor", {
          libraries: {
            DateTime: dateTime.target,
            ParabolNoteSVG: parabolNoteSVG.target,
          },
        })
      ).deploy();
    });
    it("should set initial parameters correct", async function () {
      expect(await nonFungibleNotePosition.name()).to.eq(name);
      expect(await nonFungibleNotePosition.symbol()).to.eq(symbol);
      expect(
        await nonFungibleNotePosition.hasRole(
          await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
          admin.address
        )
      ).to.be.true;
      expect(await nonFungibleNotePosition.denylister()).to.eq(
        denylister.target
      );
      expect(await nonFungibleNotePosition.paused()).to.be.false;
    });
    it("should revert with ZeroAddress if denylister is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("NonFungibleNotePosition", {
            signer: deployer,
            libraries: {
              ParabolNoteDescriptor: parabolNoteDescriptor.target,
            },
          }),
          [name, symbol, version, ZeroAddress, admin.address, pauser.address],
          {
            initializer: "initialize",
            unsafeAllowLinkedLibraries: true,
          }
        )
      ).to.be.revertedWithCustomError(
        nonFungibleNotePosition,
        "NonFungibleNotePosition__ZeroAddress"
      );
    });
    it("should revert with ZeroAddress if admin is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("NonFungibleNotePosition", {
            signer: deployer,
            libraries: {
              ParabolNoteDescriptor: parabolNoteDescriptor.target,
            },
          }),
          [
            name,
            symbol,
            version,
            denylister.target,
            ZeroAddress,
            pauser.address,
          ],
          {
            initializer: "initialize",
            unsafeAllowLinkedLibraries: true,
          }
        )
      ).to.be.revertedWithCustomError(
        nonFungibleNotePosition,
        "NonFungibleNotePosition__ZeroAddress"
      );
    });
  });

  describe("Initialization", function () {
    it("should revert with InvalidInitialization if initialized again", async function () {
      await expect(
        nonFungibleNotePosition
          .connect(admin)
          .initialize(
            name,
            symbol,
            version,
            denylister.target,
            admin.address,
            pauser.address
          )
      ).to.be.revertedWithCustomError(denylister, "InvalidInitialization");
    });
  });

  describe("Access Control", function () {
    describe("Role: RSP", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant RSP_ROLE", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .grantRole(await nonFungibleNotePosition.RSP_ROLE(), rsp.address)
        )
          .to.emit(nonFungibleNotePosition, "RoleGranted")
          .withArgs(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address,
            admin.address
          );

        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address
          )
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant RSP_ROLE", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .grantRole(await nonFungibleNotePosition.RSP_ROLE(), rsp.address)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke RSP_ROLE", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .grantRole(await nonFungibleNotePosition.RSP_ROLE(), rsp.address);
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .revokeRole(await nonFungibleNotePosition.RSP_ROLE(), rsp.address)
        )
          .to.emit(nonFungibleNotePosition, "RoleRevoked")
          .withArgs(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address,
            admin.address
          );

        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address
          )
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke RSP_ROLE", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .grantRole(await nonFungibleNotePosition.RSP_ROLE(), rsp.address);

        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .revokeRole(await nonFungibleNotePosition.RSP_ROLE(), rsp.address)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address
          )
        ).to.be.true;
      });
      it("should grant RSP_ROLE to rsp after setReserveStabilityPool", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .setReserveStabilityPool(rsp.address)
        )
          .to.emit(nonFungibleNotePosition, "RoleGranted")
          .withArgs(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address,
            admin.address
          );
        expect(await nonFungibleNotePosition.reserveStabilityPool()).to.equal(
          rsp.address
        );
      });
      it("should revert setReserveStabilityPool if new RSP is zero address", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .setReserveStabilityPool(ZeroAddress)
        ).revertedWithCustomError(
          nonFungibleNotePosition,
          "NonFungibleNotePosition__ZeroAddress"
        );
      });
      it("should revert setReserveStabilityPool if someone tries to execute", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .setReserveStabilityPool(rsp.address)
        )
          .to.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
      });
      it("should revoke RSP_ROLE from previous rsp after setReserveStabilityPool", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .setReserveStabilityPool(rsp.address);
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .setReserveStabilityPool(newRsp.address)
        )
          .to.emit(nonFungibleNotePosition, "RoleRevoked")
          .withArgs(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address,
            admin.address
          )
          .to.emit(nonFungibleNotePosition, "RoleGranted")
          .withArgs(
            await nonFungibleNotePosition.RSP_ROLE(),
            newRsp.address,
            admin.address
          );
        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.RSP_ROLE(),
            rsp.address
          )
        ).to.be.false;
      });
    });

    describe("Role: Pauser", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant PAUSER_ROLE", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .grantRole(
              await nonFungibleNotePosition.PAUSER_ROLE(),
              admin.address
            )
        )
          .to.emit(nonFungibleNotePosition, "RoleGranted")
          .withArgs(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            admin.address,
            admin.address
          );

        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            admin.address
          )
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant PAUSER_ROLE", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .grantRole(
              await nonFungibleNotePosition.PAUSER_ROLE(),
              pauser.address
            )
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke PAUSER_ROLE", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .grantRole(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            pauser.address
          );
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .revokeRole(
              await nonFungibleNotePosition.PAUSER_ROLE(),
              pauser.address
            )
        )
          .to.emit(nonFungibleNotePosition, "RoleRevoked")
          .withArgs(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            pauser.address,
            admin.address
          );

        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            pauser.address
          )
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke PAUSER_ROLE", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .grantRole(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            pauser.address
          );

        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .revokeRole(
              await nonFungibleNotePosition.PAUSER_ROLE(),
              pauser.address
            )
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.PAUSER_ROLE(),
            pauser.address
          )
        ).to.be.true;
      });
    });

    describe("Role: Admin", function () {
      it("should allow DEFAULT_ADMIN_ROLE to grant DEFAULT_ADMIN_ROLE", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .grantRole(
              await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
              newAdmin.address
            )
        )
          .to.emit(nonFungibleNotePosition, "RoleGranted")
          .withArgs(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address,
            admin.address
          );

        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          )
        ).to.be.true;
      });
      it("should not allow non-ADMIN_ROLE to grant DEFAULT_ADMIN_ROLE", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .grantRole(
              await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
              newAdmin.address
            )
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
      });
      it("should allow DEFAULT_ADMIN_ROLE to revoke DEFAULT_ADMIN_ROLE", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .grantRole(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          );
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .revokeRole(
              await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
              newAdmin.address
            )
        )
          .to.emit(nonFungibleNotePosition, "RoleRevoked")
          .withArgs(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address,
            admin.address
          );

        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          )
        ).to.be.false;
      });
      it("should not allow non-ADMIN_ROLE to revoke DEFAULT_ADMIN_ROLE", async function () {
        await nonFungibleNotePosition
          .connect(admin)
          .grantRole(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          );

        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .revokeRole(
              await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
              newAdmin.address
            )
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
        expect(
          await nonFungibleNotePosition.hasRole(
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE(),
            newAdmin.address
          )
        ).to.be.true;
      });
    });
  });

  describe("Token Operations", function () {
    let note: INonFungibleNotePosition.NoteStruct;
    beforeEach(async function () {
      note = {
        lendTimestamp: 0,
        maturityTimestamp: 0,
        coupon: 0,
        principal: 0,
        partnerFeeBPS: 0,
        partnerId: ZeroHash,
      };
      await nonFungibleNotePosition
        .connect(admin)
        .setReserveStabilityPool(rsp.address);
      await nonFungibleNotePosition
        .connect(admin)
        .grantRole(await nonFungibleNotePosition.PAUSER_ROLE(), pauser.address);
    });

    describe("Minting", function () {
      it("should mint successfully to a valid address", async function () {
        const expectedTokenId = 1;
        await expect(
          nonFungibleNotePosition.connect(rsp).mint(user.address, note)
        )
          .to.emit(nonFungibleNotePosition, "Mint")
          .withArgs(user.address, expectedTokenId)
          .to.emit(nonFungibleNotePosition, "Transfer")
          .withArgs(ZeroAddress, user.address, expectedTokenId);
        expect(await nonFungibleNotePosition.ownerOf(expectedTokenId)).to.equal(
          user.address
        );
        expect(
          await nonFungibleNotePosition.lendInfos(expectedTokenId)
        ).to.deep.eq(Object.values(note));
      });
      it("should revert with ZeroAddress if to is 0x0", async function () {
        await expect(
          nonFungibleNotePosition.connect(rsp).mint(ZeroAddress, note)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721InvalidReceiver"
          )
          .withArgs(ZeroAddress);
      });
      it("should revert minting when the contract is paused", async function () {
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(
          nonFungibleNotePosition.connect(rsp).mint(user.address, note)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "EnforcedPause"
        );
      });
      it("should revert minting if a user try to mint token", async function () {
        await expect(
          nonFungibleNotePosition.connect(user).mint(user.address, note)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(user.address, await nonFungibleNotePosition.RSP_ROLE());
      });
    });

    describe("Burning", function () {
      let tokenId: number;
      beforeEach(async function () {
        await nonFungibleNotePosition.connect(rsp).mint(user.address, note);
        tokenId = 1;
      });

      it("should rsp burn token's of user successfully using approve", async function () {
        await nonFungibleNotePosition
          .connect(user)
          .approve(rsp.address, tokenId);

        await expect(nonFungibleNotePosition.connect(rsp).burn(tokenId))
          .to.emit(nonFungibleNotePosition, "Burn")
          .withArgs(user.address, tokenId)
          .to.emit(nonFungibleNotePosition, "Transfer")
          .withArgs(user.address, ZeroAddress, tokenId);

        await expect(nonFungibleNotePosition.getApproved(tokenId))
          .to.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);

        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          0
        );
      });
      it("should rsp burn token's of user successfully using operator approval", async function () {
        await nonFungibleNotePosition
          .connect(user)
          .setApprovalForAll(rsp.address, true);

        await expect(nonFungibleNotePosition.connect(rsp).burn(tokenId))
          .to.emit(nonFungibleNotePosition, "Burn")
          .withArgs(user.address, tokenId)
          .to.emit(nonFungibleNotePosition, "Transfer")
          .withArgs(user.address, ZeroAddress, tokenId);

        await expect(nonFungibleNotePosition.getApproved(tokenId))
          .to.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);

        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          0
        );
      });
      it("should revert with ERC721NonexistentToken if token not exists", async function () {
        await expect(nonFungibleNotePosition.connect(rsp).burn(0))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(0);
      });
      it("should revert if rsp does not have enough allowance", async function () {
        await expect(
          nonFungibleNotePosition.connect(rsp).burn(tokenId)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "NonFungibleNotePosition__TokenNotApproved"
        );
      });
      it("should revert burning when the contract is paused", async function () {
        await nonFungibleNotePosition
          .connect(user)
          .approve(rsp.address, tokenId);
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(
          nonFungibleNotePosition.connect(rsp).burn(tokenId)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "EnforcedPause"
        );
      });
      it("should revert if a user try to burn token", async function () {
        await expect(nonFungibleNotePosition.connect(user).burn(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(user.address, await nonFungibleNotePosition.RSP_ROLE());
      });
    });

    describe("Pausing and Unpausing", function () {
      it("should pause the contract", async function () {
        await expect(nonFungibleNotePosition.connect(pauser).pause())
          .to.emit(nonFungibleNotePosition, "Paused")
          .withArgs(pauser.address);
        expect(await nonFungibleNotePosition.paused()).to.be.true;
      });
      it("should unpause the contract", async function () {
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(nonFungibleNotePosition.connect(pauser).unpause())
          .to.emit(nonFungibleNotePosition, "Unpaused")
          .withArgs(pauser.address);
        expect(await nonFungibleNotePosition.paused()).to.be.false;
      });
      it("should revert if non-pauser tries to pause", async function () {
        await expect(nonFungibleNotePosition.connect(someone).pause())
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.PAUSER_ROLE()
          );
      });
      it("should revert if non-pauser tries to unpause", async function () {
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(nonFungibleNotePosition.connect(someone).unpause())
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.PAUSER_ROLE()
          );
      });
    });

    describe("Approvals", function () {
      let tokenId: number;
      let note: INonFungibleNotePosition.NoteStruct;
      beforeEach(async function () {
        note = {
          lendTimestamp: 0,
          maturityTimestamp: 0,
          coupon: 0,
          principal: 0,
          partnerFeeBPS: 0,
          partnerId: ZeroHash,
        };
        await nonFungibleNotePosition.connect(rsp).mint(user.address, note);
        tokenId = 1;
      });
      it("should revert if approving a denylisted spender", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .approve(someone.address, tokenId)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "NonFungibleNotePosition__Denylisted"
          )
          .withArgs(someone.address);
      });
      it("should revert if denylisted address approving", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .approve(user.address, tokenId)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "NonFungibleNotePosition__Denylisted"
          )
          .withArgs(someone.address);
      });
      it("should revert if setting denylisted address as operator", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .setApprovalForAll(someone.address, true)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "NonFungibleNotePosition__Denylisted"
          )
          .withArgs(someone.address);
      });
      it("should revert if denylisted address setting operator", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          nonFungibleNotePosition
            .connect(someone)
            .setApprovalForAll(user.address, true)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "NonFungibleNotePosition__Denylisted"
          )
          .withArgs(someone.address);
      });
      it("should revert approving if paused", async function () {
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .approve(someone.address, tokenId)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "EnforcedPause"
        );
      });
      it("should revert setApprovalForAll if paused", async function () {
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .setApprovalForAll(someone.address, true)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "EnforcedPause"
        );
      });
      it("should approve successfully for a valid spender", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .approve(someone.address, tokenId)
        )
          .to.emit(nonFungibleNotePosition, "Approval")
          .withArgs(user.address, someone.address, tokenId);
        expect(await nonFungibleNotePosition.getApproved(tokenId)).to.equal(
          someone.address
        );
      });
      it("should set operator successfully for a valid spender", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .setApprovalForAll(someone.address, true)
        )
          .to.emit(nonFungibleNotePosition, "ApprovalForAll")
          .withArgs(user.address, someone.address, true);
        expect(
          await nonFungibleNotePosition.isApprovedForAll(
            user.address,
            someone.address
          )
        ).to.be.true;
      });
    });

    describe("Transfers", function () {
      let tokenId: number;
      let note: INonFungibleNotePosition.NoteStruct;
      beforeEach(async function () {
        note = {
          lendTimestamp: 0,
          maturityTimestamp: 0,
          coupon: 0,
          principal: 0,
          partnerFeeBPS: 0,
          partnerId: ZeroHash,
        };
        await nonFungibleNotePosition.connect(rsp).mint(user.address, note);
        tokenId = 1;
      });
      it("should allow transfer when not paused and addresses are not denylisted", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .transferFrom(user.address, someone.address, tokenId)
        )
          .to.emit(nonFungibleNotePosition, "Transfer")
          .withArgs(user.address, someone.address, tokenId);
        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          0
        );
        expect(await nonFungibleNotePosition.ownerOf(tokenId)).to.equal(
          someone.address
        );
      });
      it("should revert transfer from a denylisted address", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(user.address);
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .transferFrom(user.address, someone.address, tokenId)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "NonFungibleNotePosition__Denylisted"
          )
          .withArgs(user.address);
      });
      it("should revert transfer to a denylisted address", async function () {
        await denylister.connect(denylistAdmin).addToDenylist(someone.address);
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .transferFrom(user.address, someone.address, tokenId)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "NonFungibleNotePosition__Denylisted"
          )
          .withArgs(someone.address);
      });
      it("should revert transfer when the contract is paused", async function () {
        await nonFungibleNotePosition.connect(pauser).pause();
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .transferFrom(user.address, someone.address, tokenId)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "EnforcedPause"
        );
      });
      it("should revert transfer to zero address", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .transferFrom(user.address, ZeroAddress, tokenId)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "ERC721InvalidReceiver"
        );
      });
      it("should revert transfer if token not exist", async function () {
        await expect(
          nonFungibleNotePosition
            .connect(user)
            .transferFrom(user.address, someone.address, tokenId - 1)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId - 1);
      });
    });
  });
  describe("Update Contract Functions", function () {
    describe("updateDenylister", function () {
      it("should revert with ZeroAddress if newDenylist is zero address", async function () {
        await expect(
          nonFungibleNotePosition.connect(admin).updateDenylister(ZeroAddress)
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "NonFungibleNotePosition__ZeroAddress"
        );
      });
      it("should update the denylister address", async function () {
        const prevDenylister = denylister.target;
        ({ denylister } = await deployDenylister(
          deployer,
          denylistAdmin.address
        ));
        expect(await nonFungibleNotePosition.denylister()).to.equal(
          prevDenylister
        );
        expect(denylister.target).to.not.equal(prevDenylister);
        await expect(
          nonFungibleNotePosition
            .connect(admin)
            .updateDenylister(denylister.target)
        )
          .to.emit(nonFungibleNotePosition, "DenylisterUpdated")
          .withArgs(denylister.target);
      });
      it("should revert if someone tries to update the denylister address", async function () {
        await expect(
          nonFungibleNotePosition.connect(someone).updateDenylister(ZeroAddress)
        )
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await nonFungibleNotePosition.DEFAULT_ADMIN_ROLE()
          );
      });
    });
  });
});
