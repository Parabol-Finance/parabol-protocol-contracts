import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import {
  parseEther,
  Signature,
  ZeroAddress,
  id,
  zeroPadValue,
  ZeroHash,
} from "ethers";
import {
  Denylister,
  NonFungibleNotePosition,
  ParabolUSD,
  ReserveStabilityPool,
} from "../typechain-types";
import {
  deployDenylister,
  deployNonFungibleNotePosition,
  deployParabolUSD,
  deployReserveStabilityPool,
} from "../scripts/helpers/deployScripts";
import { signERC721Permit } from "./helpers/erc721Signature";
import { signERC20Permit } from "./helpers/erc20Signature";
import { signPriceFeed, PriceFeed } from "./helpers/priceFeedSignature";
import { SignerWithAddress as Signer } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ONE_DAY_TIMESTAMP = 60 * 60 * 24;
const ONE_YEAR_TIMESTAMP = 60 * 60 * 24 * 30 * 12;
const EXACT_1e25 = BigInt("10000000000000000000000000");

async function createMockPriceFeedSignature(
  currentTimestamp: number,
  reserveStabilityPool: ReserveStabilityPool,
  verifierSigner: Signer,
  verifierName: string,
  verifierVersion: string,
  maturityTimestamp?: number,
  validAfter?: number,
  validBefore?: number
): Promise<{ priceFeed: PriceFeed; priceFeedSignature: Signature }> {
  const coupon = 545;
  maturityTimestamp =
    maturityTimestamp ?? currentTimestamp + ONE_YEAR_TIMESTAMP; // 12 months
  validAfter = validAfter ?? currentTimestamp - ONE_DAY_TIMESTAMP;
  validBefore = validBefore ?? currentTimestamp + ONE_DAY_TIMESTAMP;
  const priceFeed = {
    maturityTimestamp: maturityTimestamp,
    coupon: coupon,
    validBefore: validBefore,
    validAfter: validAfter,
  };
  return {
    priceFeed: priceFeed,
    priceFeedSignature: await signPriceFeed(
      reserveStabilityPool.target as string,
      verifierName,
      verifierVersion,
      verifierSigner,
      priceFeed
    ),
  };
}

describe("ReserveStabilityPool Contract", function () {
  let nonFungibleNotePosition: NonFungibleNotePosition;
  let paraUSD: ParabolUSD;
  let reserveStabilityPool: ReserveStabilityPool;
  let denylister: Denylister;
  let paraUSDName: string;
  let paraUSDSymbol: string;
  let paraUSDVersion: string;
  let nonFungibleNotePositionName: string;
  let nonFungibleNotePositionSymbol: string;
  let nonFungibleNotePositionVersion: string;
  let verifierName: string;
  let verifierVersion: string;
  let deployer: Signer;
  let admin: Signer;
  let verifierSigner: Signer;
  let minter: Signer;
  let burner: Signer;
  let pauser: Signer;
  let partner: Signer;
  let user: Signer;
  let user2: Signer;
  let someone: Signer;
  let DENOMINATOR: number;

  async function deployReserveStabilityPoolFixture(): Promise<{
    denylister: Denylister;
    nonFungibleNotePosition: NonFungibleNotePosition;
    paraUSD: ParabolUSD;
    reserveStabilityPool: ReserveStabilityPool;
  }> {
    const { denylister } = await deployDenylister(deployer, admin.address);
    const { nonFungibleNotePosition } = await deployNonFungibleNotePosition(
      deployer,
      nonFungibleNotePositionName,
      nonFungibleNotePositionSymbol,
      nonFungibleNotePositionVersion,
      denylister.target as string,
      admin.address,
      pauser.address
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
    const { reserveStabilityPool } = await deployReserveStabilityPool(
      deployer,
      paraUSD.target as string,
      nonFungibleNotePosition.target as string,
      verifierName,
      verifierVersion,
      verifierSigner.address,
      admin.address,
      admin.address,
      pauser.address
    );
    await nonFungibleNotePosition
      .connect(admin)
      .setReserveStabilityPool(reserveStabilityPool.target);
    await nonFungibleNotePosition
      .connect(admin)
      .grantRole(await nonFungibleNotePosition.PAUSER_ROLE(), pauser.address);
    await paraUSD
      .connect(admin)
      .grantRole(await paraUSD.MINTER_ROLE(), reserveStabilityPool.target);
    await paraUSD
      .connect(admin)
      .grantRole(await paraUSD.MINTER_ROLE(), minter.address);
    await paraUSD
      .connect(admin)
      .grantRole(await paraUSD.BURNER_ROLE(), minter.address);
    await paraUSD
      .connect(admin)
      .grantRole(await paraUSD.PAUSER_ROLE(), pauser.address);

    await reserveStabilityPool
      .connect(admin)
      .grantRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address);
    return {
      denylister,
      nonFungibleNotePosition,
      paraUSD,
      reserveStabilityPool,
    };
  }

  beforeEach(async function () {
    nonFungibleNotePositionName = "paraUSD RSP Note NFT-V1";
    nonFungibleNotePositionSymbol = "PARAUSD-RSP-NOTE";
    nonFungibleNotePositionVersion = "1";

    paraUSDName = "Parabol USD";
    paraUSDSymbol = "paraUSD";
    paraUSDVersion = "1";

    verifierName = "NoteSignatureVerifier";
    verifierVersion = "1";

    [
      deployer,
      admin,
      verifierSigner,
      minter,
      burner,
      pauser,
      partner,
      user,
      user2,
      someone,
    ] = await ethers.getSigners();

    ({ denylister, nonFungibleNotePosition, paraUSD, reserveStabilityPool } =
      await loadFixture(deployReserveStabilityPoolFixture));
    DENOMINATOR = Number(await reserveStabilityPool.DENOMINATOR());
  });
  describe("Deployment", function () {
    it("should set initial parameters correct", async function () {
      const feedSignatureVerifierStorageValue0 =
        await ethers.provider.getStorage(
          reserveStabilityPool.target,
          "0x2d50a7cd9c750f906a8b1d1a3d86ef8ee90956378c2ec3a58fb384b6ec7e7700"
        );
      const feedSignatureVerifierStorageValue1 =
        await ethers.provider.getStorage(
          reserveStabilityPool.target,
          "0x2d50a7cd9c750f906a8b1d1a3d86ef8ee90956378c2ec3a58fb384b6ec7e7701"
        );
      const feedSignatureVerifierStorageValue2 =
        await ethers.provider.getStorage(
          reserveStabilityPool.target,
          "0x2d50a7cd9c750f906a8b1d1a3d86ef8ee90956378c2ec3a58fb384b6ec7e7702"
        );
      const verifierNameHash = id(verifierName);
      const verifierVersionHash = id(verifierVersion);
      expect(feedSignatureVerifierStorageValue0).to.equal(
        zeroPadValue(verifierSigner.address, 32)
      );
      expect(feedSignatureVerifierStorageValue1).to.equal(verifierNameHash);
      expect(feedSignatureVerifierStorageValue2).to.equal(verifierVersionHash);
      expect(await reserveStabilityPool.paraUSD()).to.equal(
        paraUSD.target as string
      );
      expect(await reserveStabilityPool.nonFungibleNotePosition()).to.equal(
        nonFungibleNotePosition.target as string
      );
      expect(await reserveStabilityPool.minLendLimit()).to.equal(
        parseEther("1000")
      );
      expect(
        await reserveStabilityPool.hasRole(
          await reserveStabilityPool.DEFAULT_ADMIN_ROLE(),
          admin.address
        )
      ).to.equal(true);
      expect(await reserveStabilityPool.paused()).to.equal(false);
      expect(await reserveStabilityPool.minLendLimit()).to.equal(
        parseEther("1000")
      );
    });
    it("should revert with ZeroAddress if paraUSD is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("ReserveStabilityPool", deployer),
          [
            ZeroAddress,
            nonFungibleNotePosition.target,
            verifierName,
            verifierVersion,
            verifierSigner.address,
            admin.address,
            admin.address,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        reserveStabilityPool,
        "ReserveStabilityPool__ZeroAddress"
      );
    });
    it("should revert with ZeroAddress if nonFungibleNotePosition is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("ReserveStabilityPool", deployer),
          [
            paraUSD.target,
            ZeroAddress,
            verifierName,
            verifierVersion,
            verifierSigner.address,
            admin.address,
            admin.address,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        reserveStabilityPool,
        "ReserveStabilityPool__ZeroAddress"
      );
    });
    it("should revert with ZeroAddress if verifierSigner is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("ReserveStabilityPool", deployer),
          [
            paraUSD.target,
            nonFungibleNotePosition.target,
            verifierName,
            verifierVersion,
            ZeroAddress,
            admin.address,
            admin.address,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        reserveStabilityPool,
        "ReserveStabilityPool__ZeroAddress"
      );
    });
    it("should revert with ZeroAddress if admin is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("ReserveStabilityPool", deployer),
          [
            paraUSD.target,
            nonFungibleNotePosition.target,
            verifierName,
            verifierVersion,
            verifierSigner.address,
            ZeroAddress,
            admin.address,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        reserveStabilityPool,
        "ReserveStabilityPool__ZeroAddress"
      );
    });
    it("should revert with ZeroAddress if floating income account is zero address", async function () {
      await expect(
        upgrades.deployProxy(
          await ethers.getContractFactory("ReserveStabilityPool", deployer),
          [
            paraUSD.target,
            nonFungibleNotePosition.target,
            verifierName,
            verifierVersion,
            verifierSigner.address,
            admin.address,
            ZeroAddress,
            pauser.address,
          ],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(
        reserveStabilityPool,
        "ReserveStabilityPool__ZeroAddress"
      );
    });
  });
  describe("Initialization", function () {
    it("should revert with InvalidInitialization if initialized again", async function () {
      await expect(
        reserveStabilityPool
          .connect(admin)
          .initialize(
            paraUSD.target as string,
            nonFungibleNotePosition.target as string,
            verifierName,
            verifierVersion,
            verifierSigner.address,
            admin.address,
            admin.address,
            pauser.address
          )
      ).to.be.revertedWithCustomError(denylister, "InvalidInitialization");
    });
  });
  describe("Setters", function () {
    describe("minLendLimit", function () {
      it("should revert if caller is not admin", async function () {
        await expect(reserveStabilityPool.connect(user).setMinLendLimit(1000))
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            user.address,
            await reserveStabilityPool.DEFAULT_ADMIN_ROLE()
          );
      });
      it("should set minLendLimit correctly", async function () {
        const newMinLendLimit = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .setMinLendLimit(newMinLendLimit);
        expect(await reserveStabilityPool.minLendLimit()).to.equal(
          newMinLendLimit
        );
      });
    });
    describe("should set verifierSigner correctly", function () {
      it("should revert with ZeroAddress if verifierSigner is zero address", async function () {
        await expect(
          reserveStabilityPool.connect(admin).setVerifierSigner(ZeroAddress)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "FeedSignatureVerifier__ZeroAddress"
        );
      });
      it("should revert if caller is not admin", async function () {
        await expect(
          reserveStabilityPool.connect(user).setVerifierSigner(user.address)
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            user.address,
            await reserveStabilityPool.DEFAULT_ADMIN_ROLE()
          );
      });
      it("should set verifierSigner correctly", async function () {
        const newVerifierSigner = someone.address;
        await reserveStabilityPool
          .connect(admin)
          .setVerifierSigner(newVerifierSigner);
        expect(
          await ethers.provider.getStorage(
            reserveStabilityPool.target,
            "0x2d50a7cd9c750f906a8b1d1a3d86ef8ee90956378c2ec3a58fb384b6ec7e7700"
          )
        ).to.equal(zeroPadValue(newVerifierSigner, 32));
      });
    });
    describe("setMaxCouponLimit", function () {
      it("should set maxCouponLimit correctly", async function () {
        const newMaxCouponLimit = 500;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .setMaxCouponLimit(newMaxCouponLimit)
        ).to.emit(reserveStabilityPool, "MaxCouponLimitUpdated");

        const maxCouponLimit = await ethers.provider.getStorage(
          reserveStabilityPool.target,
          "0x030d259693df83873330f86abeddae6a3ea94185fb1c088ba468a516ad6ea603"
        );
        expect(parseInt(maxCouponLimit, 16)).to.equal(newMaxCouponLimit);
      });
      it("should revert with ReserveStabilityPool__SameMaxCouponLimit if new maxCouponLimit is same as old maxCouponLimit", async function () {
        const currentMaxCouponLimit = parseInt(
          await ethers.provider.getStorage(
            reserveStabilityPool.target,
            "0x030d259693df83873330f86abeddae6a3ea94185fb1c088ba468a516ad6ea603"
          ),
          16
        );
        await expect(
          reserveStabilityPool
            .connect(admin)
            .setMaxCouponLimit(currentMaxCouponLimit)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__SameMaxCouponLimit"
        );
      });
      it("should revert if caller is not admin", async function () {
        await expect(reserveStabilityPool.connect(user).setMaxCouponLimit(1000))
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            user.address,
            await reserveStabilityPool.DEFAULT_ADMIN_ROLE()
          );
      });
    });
    describe("setMinMaturityLimit", function () {
      it("should set minMaturityLimit correctly", async function () {
        const newMinMaturityLimit = 500;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .setMinMaturityLimit(newMinMaturityLimit)
        ).to.emit(reserveStabilityPool, "MinMaturityLimitUpdated");

        const minMaturityLimit = await ethers.provider.getStorage(
          reserveStabilityPool.target,
          "0x030d259693df83873330f86abeddae6a3ea94185fb1c088ba468a516ad6ea605"
        );
        expect(parseInt(minMaturityLimit, 16)).to.equal(newMinMaturityLimit);
      });
      it("should revert with ReserveStabilityPool__SameMinMaturityLimit if new minMaturityLimit is same as old minMaturityLimit", async function () {
        const currentMinMaturityLimit = parseInt(
          await ethers.provider.getStorage(
            reserveStabilityPool.target,
            "0x030d259693df83873330f86abeddae6a3ea94185fb1c088ba468a516ad6ea605"
          ),
          16
        );
        await expect(
          reserveStabilityPool
            .connect(admin)
            .setMinMaturityLimit(currentMinMaturityLimit)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__SameMinMaturityLimit"
        );
      });
      it("should revert if caller is not admin", async function () {
        await expect(
          reserveStabilityPool.connect(user).setMinMaturityLimit(1000)
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            user.address,
            await reserveStabilityPool.DEFAULT_ADMIN_ROLE()
          );
      });
    });
  });
  describe("Pausing and Unpausing", function () {
    it("should pause the contract", async function () {
      await expect(reserveStabilityPool.connect(pauser).pause())
        .to.emit(reserveStabilityPool, "Paused")
        .withArgs(pauser.address);
      expect(await reserveStabilityPool.paused()).to.be.true;
    });
    it("should unpause the contract", async function () {
      await reserveStabilityPool.connect(pauser).pause();
      await expect(reserveStabilityPool.connect(pauser).unpause())
        .to.emit(reserveStabilityPool, "Unpaused")
        .withArgs(pauser.address);
      expect(await reserveStabilityPool.paused()).to.be.false;
    });
    it("should revert if non-pauser tries to pause", async function () {
      await expect(reserveStabilityPool.connect(someone).pause())
        .to.be.revertedWithCustomError(
          reserveStabilityPool,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(someone.address, await reserveStabilityPool.PAUSER_ROLE());
    });
    it("should revert if non-pauser tries to unpause", async function () {
      await reserveStabilityPool.connect(pauser).pause();
      await expect(reserveStabilityPool.connect(someone).unpause())
        .to.be.revertedWithCustomError(
          reserveStabilityPool,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(someone.address, await reserveStabilityPool.PAUSER_ROLE());
    });
  });
  describe("Pauser Role Access Control", function () {
    it("should allow DEFAULT_ADMIN_ROLE to grant PAUSER_ROLE", async function () {
      await reserveStabilityPool
        .connect(admin)
        .revokeRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address);
      await expect(
        reserveStabilityPool
          .connect(admin)
          .grantRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address)
      )
        .to.emit(reserveStabilityPool, "RoleGranted")
        .withArgs(
          await reserveStabilityPool.PAUSER_ROLE(),
          pauser.address,
          admin.address
        );

      expect(
        await reserveStabilityPool.hasRole(
          await reserveStabilityPool.PAUSER_ROLE(),
          pauser.address
        )
      ).to.be.true;
    });
    it("should not allow non-ADMIN_ROLE to grant PAUSER_ROLE", async function () {
      await expect(
        reserveStabilityPool
          .connect(someone)
          .grantRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address)
      )
        .to.be.revertedWithCustomError(
          reserveStabilityPool,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(
          someone.address,
          await reserveStabilityPool.DEFAULT_ADMIN_ROLE()
        );
    });
    it("should allow DEFAULT_ADMIN_ROLE to revoke PAUSER_ROLE", async function () {
      await expect(
        reserveStabilityPool
          .connect(admin)
          .revokeRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address)
      )
        .to.emit(reserveStabilityPool, "RoleRevoked")
        .withArgs(
          await reserveStabilityPool.PAUSER_ROLE(),
          pauser.address,
          admin.address
        );

      expect(
        await reserveStabilityPool.hasRole(
          await reserveStabilityPool.PAUSER_ROLE(),
          pauser.address
        )
      ).to.be.false;
    });
    it("should not allow non-ADMIN_ROLE to revoke PAUSER_ROLE", async function () {
      await reserveStabilityPool
        .connect(admin)
        .grantRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address);

      await expect(
        reserveStabilityPool
          .connect(someone)
          .revokeRole(await reserveStabilityPool.PAUSER_ROLE(), pauser.address)
      )
        .to.be.revertedWithCustomError(
          reserveStabilityPool,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(
          someone.address,
          await reserveStabilityPool.DEFAULT_ADMIN_ROLE()
        );
      expect(
        await reserveStabilityPool.hasRole(
          await reserveStabilityPool.PAUSER_ROLE(),
          pauser.address
        )
      ).to.be.true;
    });
  });
  describe("PartnerFeeManager", function () {
    let partnerId: string;
    let partnerFeeBPS = 1000;
    let tokenId = 1;
    let principal = parseEther("1000");
    beforeEach(async function () {
      const partnerNonce = await reserveStabilityPool.getPartnerNonce(
        partner.address
      );
      await reserveStabilityPool
        .connect(partner)
        .createPartner(partner.address, partnerFeeBPS);
      partnerId = await reserveStabilityPool.getPartnerIdByNonce(
        partner.address,
        partnerNonce
      );
    });
    describe("createPartner", function () {
      it("should create partner account successfully", async function () {
        const partnerNonce = await reserveStabilityPool.getPartnerNonce(
          partner.address
        );
        const expectedPartnerId =
          await reserveStabilityPool.getPartnerIdByNonce(
            partner.address,
            partnerNonce
          );
        await expect(
          reserveStabilityPool
            .connect(partner)
            .createPartner(partner.address, 1000)
        )
          .to.emit(reserveStabilityPool, "PartnerCreated")
          .withArgs(expectedPartnerId, partner.address, partner.address, 1000);

        expect(
          await reserveStabilityPool.getPartnerInfoByOwner(
            partner.address,
            partnerNonce
          )
        ).to.deep.eq([true, partner.address, partner.address, 1000]);

        expect(
          await reserveStabilityPool.getPartnerInfoById(expectedPartnerId)
        ).to.deep.eq([true, partner.address, partner.address, 1000]);
      });
      it("should revert get partner id by nonce if partner is zero address", async function () {
        await expect(
          reserveStabilityPool.getPartnerIdByNonce(ZeroAddress, 0)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__ZeroAddress"
        );
      });
      it("should revert get partner info by id if partner id is not exists", async function () {
        // create random bytes32 value
        const randomBytes32 = ethers.randomBytes(32);
        await expect(reserveStabilityPool.getPartnerInfoById(randomBytes32))
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "PartnerFeeManager__PartnerIdNotExists"
          )
          .withArgs(randomBytes32);
      });
      it("should revert create parner if fee is not in range", async function () {
        const fee = (await reserveStabilityPool.DENOMINATOR()) + 1n;
        await expect(
          reserveStabilityPool
            .connect(partner)
            .createPartner(partner.address, fee)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__InvalidFee"
        );
      });
      it("should revert create parner if vault is zero address", async function () {
        await expect(
          reserveStabilityPool.connect(partner).createPartner(ZeroAddress, 1000)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__ZeroAddress"
        );
      });
    });
    describe("transferPartnerOwnership", function () {
      it("should transferPartnerOwnership successfully", async function () {
        await expect(
          reserveStabilityPool
            .connect(partner)
            .transferPartnerOwnership(partnerId, user.address)
        )
          .to.emit(reserveStabilityPool, "PartnerOwnershipTransferred")
          .withArgs(partnerId, user.address);
        expect(
          await reserveStabilityPool.getPartnerInfoById(partnerId)
        ).to.deep.eq([true, user.address, partner.address, 1000]);
      });
      it("should revert transferPartnerOwnership if owner is zero address", async function () {
        await expect(
          reserveStabilityPool
            .connect(partner)
            .transferPartnerOwnership(partnerId, ZeroAddress)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__ZeroAddress"
        );
      });
      it("should revert transferPartnerOwnership if new owner is same as old owner", async function () {
        await expect(
          reserveStabilityPool
            .connect(partner)
            .transferPartnerOwnership(partnerId, partner.address)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__SameOwner"
        );
      });
      it("should revert transferPartnerOwnership if msg.sender is not partner owner", async function () {
        await expect(
          reserveStabilityPool
            .connect(user)
            .transferPartnerOwnership(partnerId, user.address)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__NotPartnerOwner"
        );
      });
    });
    describe("setPartnerVault", function () {
      it("should change partner vault successfully", async function () {
        const partnerNonce = await reserveStabilityPool.getPartnerNonce(
          partner.address
        );
        const expectedPartnerId =
          await reserveStabilityPool.getPartnerIdByNonce(
            partner.address,
            partnerNonce
          );
        await reserveStabilityPool
          .connect(partner)
          .createPartner(partner.address, 1000);
        await expect(
          reserveStabilityPool
            .connect(partner)
            .setPartnerVault(expectedPartnerId, user.address)
        )
          .to.emit(reserveStabilityPool, "PartnerVaultChanged")
          .withArgs(expectedPartnerId, user.address);
        expect(
          await reserveStabilityPool.getPartnerInfoById(expectedPartnerId)
        ).to.deep.eq([true, partner.address, user.address, 1000]);
      });
      it("should revert setPartnerVault if vault is zero address", async function () {
        await expect(
          reserveStabilityPool
            .connect(partner)
            .setPartnerVault(partnerId, ZeroAddress)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__ZeroAddress"
        );
      });
      it("should revert setPartnerVault if new vault is same as old vault", async function () {
        await expect(
          reserveStabilityPool
            .connect(partner)
            .setPartnerVault(partnerId, partner.address)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__SameVaultAddress"
        );
      });
      it("should revert setPartnerVault if msg.sender is not partner owner", async function () {
        await expect(
          reserveStabilityPool
            .connect(user)
            .setPartnerVault(partnerId, user.address)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__NotPartnerOwner"
        );
      });
    });
    describe("setPartnerFee", function () {
      it("should setPartnerFee successfully", async function () {
        await expect(
          reserveStabilityPool.connect(partner).setPartnerFee(partnerId, 2000)
        )
          .to.emit(reserveStabilityPool, "PartnerFeeChanged")
          .withArgs(partnerId, 2000);
        expect(
          await reserveStabilityPool.getPartnerInfoById(partnerId)
        ).to.deep.eq([true, partner.address, partner.address, 2000]);
      });
      it("should revert setPartnerFee if fee is not in range", async function () {
        const fee = (await reserveStabilityPool.DENOMINATOR()) + 1n;
        await expect(
          reserveStabilityPool.connect(partner).setPartnerFee(partnerId, fee)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__InvalidFee"
        );
      });
      it("should revert setPartnerFee if fee is same as old fee", async function () {
        const partnerFee = (
          await reserveStabilityPool.getPartnerInfoById(partnerId)
        )._partnerFeeBPS;
        await expect(
          reserveStabilityPool
            .connect(partner)
            .setPartnerFee(partnerId, partnerFee)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__SameFee"
        );
      });
      it("should revert setPartnerFee if msg.sender is not partner owner", async function () {
        await expect(
          reserveStabilityPool.connect(user).setPartnerFee(partnerId, 2000)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "PartnerFeeManager__NotPartnerOwner"
        );
      });
      it("should revert lend if partner fee changes", async function () {
        const principal = parseEther("1000");
        await paraUSD.connect(minter).mint(user.address, principal);
        const currentTimestamp = await time.latest();
        const coupon = 5.45 * 100;
        const maturityTimestamp = currentTimestamp + ONE_YEAR_TIMESTAMP; // 12 months
        const validBefore = currentTimestamp + 60 * 60 * 24;
        const validAfter = currentTimestamp - 60 * 60 * 24;
        const priceFeed = {
          maturityTimestamp: maturityTimestamp,
          coupon: coupon,
          validBefore: validBefore,
          validAfter: validAfter,
        };
        const priceFeedSignature = await signPriceFeed(
          reserveStabilityPool.target as string,
          verifierName,
          verifierVersion,
          verifierSigner,
          priceFeed
        );

        await paraUSD
          .connect(user)
          .approve(reserveStabilityPool.target, principal);

        await reserveStabilityPool
          .connect(partner)
          .setPartnerFee(partnerId, 2000);

        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: partnerId,
              partnerFeeBPS: 1000,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__PartnerFeeChanged"
        );
      });
    });
    describe("should calculate partner fee correctly", function () {
      let priceFeed: PriceFeed;
      let priceFeedSignature: Signature;
      let lendTimestamp: number;
      let totalIncome: bigint;
      let protocolFee: bigint;
      let userIncome: bigint;
      beforeEach(async function () {
        const currentTimestamp = await time.latest();
        ({ priceFeed, priceFeedSignature } = await createMockPriceFeedSignature(
          currentTimestamp,
          reserveStabilityPool,
          verifierSigner,
          verifierName,
          verifierVersion
        ));
        await paraUSD.connect(minter).mint(user.address, principal);
        await paraUSD
          .connect(user)
          .approve(reserveStabilityPool.target, principal);

        await reserveStabilityPool.connect(user).lend(
          {
            beneficiary: user.address,
            principal: principal,
            partnerId: partnerId,
            partnerFeeBPS: partnerFeeBPS,
          },
          priceFeed,
          {
            v: priceFeedSignature.v,
            r: priceFeedSignature.r,
            s: priceFeedSignature.s,
          }
        );
        lendTimestamp = await time.latest();
        totalIncome =
          (principal *
            BigInt(priceFeed.coupon) *
            BigInt(priceFeed.maturityTimestamp - lendTimestamp)) /
          (BigInt(ONE_YEAR_TIMESTAMP) * BigInt(DENOMINATOR));

        protocolFee =
          (totalIncome * BigInt(partnerFeeBPS)) / BigInt(DENOMINATOR);
        userIncome = totalIncome - protocolFee;
      });
      it("should calculate partner fee correctly", async function () {
        await time.increaseTo(priceFeed.maturityTimestamp + 1);
        await nonFungibleNotePosition
          .connect(user)
          .approve(reserveStabilityPool.target, tokenId);

        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        )
          .to.emit(reserveStabilityPool, "Claim")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            totalIncome,
            protocolFee,
            partnerId
          );
        expect(await paraUSD.balanceOf(user.address)).to.equal(
          userIncome + principal
        );
        expect(await paraUSD.balanceOf(partner.address)).to.equal(protocolFee);
        expect(await paraUSD.balanceOf(reserveStabilityPool.target)).to.equal(
          0
        );
      });
      it("should changing partner fee after lend doesn't affect the fee", async function () {
        const totalIncome =
          (principal *
            BigInt(priceFeed.coupon) *
            BigInt(priceFeed.maturityTimestamp - lendTimestamp)) /
          (BigInt(ONE_YEAR_TIMESTAMP) * BigInt(DENOMINATOR));

        const protocolFee =
          (totalIncome * BigInt(partnerFeeBPS)) / BigInt(DENOMINATOR);

        await reserveStabilityPool
          .connect(partner)
          .setPartnerFee(partnerId, 2000);
        await time.increaseTo(priceFeed.maturityTimestamp + 1);
        await nonFungibleNotePosition
          .connect(user)
          .approve(reserveStabilityPool.target, tokenId);
        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        )
          .to.emit(reserveStabilityPool, "Claim")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            totalIncome,
            protocolFee,
            partnerId
          );
      });
      it("should ensure that if the partner vault changes after lending, the fee is directed to the new vault", async function () {
        await reserveStabilityPool
          .connect(partner)
          .setPartnerVault(partnerId, admin.address);
        await time.increaseTo(priceFeed.maturityTimestamp + 1);
        await nonFungibleNotePosition
          .connect(user)
          .approve(reserveStabilityPool.target, tokenId);
        await reserveStabilityPool.connect(user).claim(user.address, tokenId);
        expect(await paraUSD.balanceOf(admin.address)).to.equal(protocolFee);
      });
    });
  });
  describe("Lend", function () {
    let principal = parseEther("1000");
    let priceFeed: PriceFeed;
    let priceFeedSignature: Signature;

    beforeEach(async function () {
      await paraUSD.connect(minter).mint(user.address, principal);
      const currentTimestamp = await time.latest();
      ({ priceFeed, priceFeedSignature } = await createMockPriceFeedSignature(
        currentTimestamp,
        reserveStabilityPool,
        verifierSigner,
        verifierName,
        verifierVersion
      ));
    });
    describe("lend", function () {
      beforeEach(async function () {
        await paraUSD
          .connect(user)
          .approve(reserveStabilityPool.target, principal);
      });
      it("should lend successfully", async function () {
        let tokenId = 1;
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        )
          .to.emit(reserveStabilityPool, "Lend")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            ZeroHash,
            0n
          );
        const lendTimestamp = await time.latest();
        expect(await paraUSD.balanceOf(user.address)).to.equal(0);
        expect(await paraUSD.balanceOf(reserveStabilityPool.target)).to.equal(
          principal
        );
        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          1
        );
        expect(await nonFungibleNotePosition.ownerOf(tokenId)).to.equal(
          user.address
        );
        expect(await nonFungibleNotePosition.getLendInfo(tokenId)).to.deep.eq([
          lendTimestamp,
          priceFeed.maturityTimestamp,
          priceFeed.coupon,
          principal,
          0n,
          ZeroHash,
        ]);
      });
      it("should revert lend if PriceFeed signed by wrong signer", async function () {
        const priceFeedSignature = await signPriceFeed(
          reserveStabilityPool.target as string,
          verifierName,
          verifierVersion,
          someone,
          priceFeed
        );
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__InvalidSigner"
          )
          .withArgs(someone.address, verifierSigner.address);
      });
      it("should revert lend if paused", async function () {
        await reserveStabilityPool.connect(pauser).pause();
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
      });
      it("should revert lend if maturityTimestamp is in the past", async function () {
        const currentTimestamp = await time.latest();
        const { priceFeed, priceFeedSignature } =
          await createMockPriceFeedSignature(
            currentTimestamp,
            reserveStabilityPool,
            verifierSigner,
            verifierName,
            verifierVersion,
            currentTimestamp - 1
          );
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__InvalidMaturityTimestamp"
          )
          .withArgs(priceFeed.maturityTimestamp);
      });
      it("should revert lend if PriceFeed expired", async function () {
        await time.increaseTo(priceFeed.validBefore + 1);
        await expect(
          reserveStabilityPool.validatePriceFeed(priceFeed, {
            v: priceFeedSignature.v,
            r: priceFeedSignature.r,
            s: priceFeedSignature.s,
          })
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__FeedExpired"
          )
          .withArgs(priceFeed.validBefore);
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__FeedExpired"
          )
          .withArgs(priceFeed.validBefore);
      });
      it("should revert lend if PriceFeed not yet valid", async function () {
        let currentTimestamp = await time.latest();
        const { priceFeed, priceFeedSignature } =
          await createMockPriceFeedSignature(
            currentTimestamp,
            reserveStabilityPool,
            verifierSigner,
            verifierName,
            verifierVersion,
            undefined,
            currentTimestamp + 60
          );
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__FeedNotYetValid"
          )
          .withArgs(priceFeed.validAfter);
      });
      it("should revert lend if minLendLimit is not met", async function () {
        await reserveStabilityPool
          .connect(admin)
          .setMinLendLimit(parseEther("10000"));
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__InsufficientPrincipal"
        );
      });
      it("should revert lend if allowance is not enough", async function () {
        await paraUSD
          .connect(user)
          .approve(reserveStabilityPool.target, principal - 1n);
        await expect(
          reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          )
        )
          .to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance")
          .withArgs(reserveStabilityPool.target, principal - 1n, principal);
      });
    });
    describe("permitLend", function () {
      let paraUSDPermitSignature: Signature;
      let paraUSDPermitDeadline: number;
      beforeEach(async function () {
        paraUSDPermitDeadline = (await time.latest()) + 60 * 10; // 10 minutes
        paraUSDPermitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          reserveStabilityPool.target as string,
          principal,
          Number(await paraUSD.nonces(user.address)),
          paraUSDPermitDeadline
        );
      });
      it("should permitLend successfully", async function () {
        let tokenId = 1;
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },
            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        )
          .to.emit(reserveStabilityPool, "Lend")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            ZeroHash,
            0n
          );
        const lendTimestamp = await time.latest();
        expect(await paraUSD.balanceOf(user.address)).to.equal(0);
        expect(await paraUSD.balanceOf(reserveStabilityPool.target)).to.equal(
          principal
        );
        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          1
        );
        expect(await nonFungibleNotePosition.ownerOf(tokenId)).to.equal(
          user.address
        );
        expect(await nonFungibleNotePosition.getLendInfo(tokenId)).to.deep.eq([
          lendTimestamp,
          priceFeed.maturityTimestamp,
          priceFeed.coupon,
          principal,
          0n,
          ZeroHash,
        ]);
      });
      it("should revert permitLend if paused", async function () {
        await reserveStabilityPool.connect(pauser).pause();
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },
            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
      });
      it("should revert permitLend if maturityTimestamp is in the past", async function () {
        const currentTimestamp = await time.latest();
        const { priceFeed, priceFeedSignature } =
          await createMockPriceFeedSignature(
            currentTimestamp,
            reserveStabilityPool,
            verifierSigner,
            verifierName,
            verifierVersion,
            currentTimestamp - 1
          );
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },
            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__InvalidMaturityTimestamp"
          )
          .withArgs(priceFeed.maturityTimestamp);
      });
      it("should revert permitLend if PriceFeed expired", async function () {
        paraUSDPermitDeadline = priceFeed.validBefore + 60 * 10;
        paraUSDPermitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          reserveStabilityPool.target as string,
          principal,
          Number(await paraUSD.nonces(user.address)),
          paraUSDPermitDeadline
        );
        await time.increaseTo(priceFeed.validBefore + 1);
        await expect(
          reserveStabilityPool.validatePriceFeed(priceFeed, {
            v: priceFeedSignature.v,
            r: priceFeedSignature.r,
            s: priceFeedSignature.s,
          })
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__FeedExpired"
          )
          .withArgs(priceFeed.validBefore);
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },

            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__FeedExpired"
          )
          .withArgs(priceFeed.validBefore);
      });
      it("should revert permitLend if PriceFeed not yet valid", async function () {
        const currentTimestamp = await time.latest();
        const { priceFeed, priceFeedSignature } =
          await createMockPriceFeedSignature(
            currentTimestamp,
            reserveStabilityPool,
            verifierSigner,
            verifierName,
            verifierVersion,
            undefined,
            currentTimestamp + 60,
            undefined
          );
        paraUSDPermitDeadline = priceFeed.validBefore + 60 * 10;
        paraUSDPermitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          reserveStabilityPool.target as string,
          principal,
          Number(await paraUSD.nonces(user.address)),
          paraUSDPermitDeadline
        );
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },

            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "FeedSignatureVerifier__FeedNotYetValid"
          )
          .withArgs(priceFeed.validAfter);
      });
      it("should revert permitLend if minLendLimit is not met", async function () {
        await reserveStabilityPool
          .connect(admin)
          .setMinLendLimit(parseEther("10000"));
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },

            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__InsufficientPrincipal"
        );
      });
      it("should revert permitLend if allowance is not enough", async function () {
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal + 1n,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },
            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance");
      });
      it("should revert permitLend if permit is expired", async function () {
        await time.increaseTo(paraUSDPermitDeadline + 1);
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },

            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance");
      });
      it("should revert permitLend if permit nonce is invalid", async function () {
        paraUSDPermitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          reserveStabilityPool.target as string,
          principal,
          Number(await paraUSD.nonces(user.address)) + 1,
          paraUSDPermitDeadline
        );
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },
            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance");
      });
      it("should revert permitLend if permit signed by another user", async function () {
        paraUSDPermitSignature = await signERC20Permit(
          paraUSD.target as string,
          paraUSDName,
          paraUSDVersion,
          user,
          reserveStabilityPool.target as string,
          principal,
          Number(await paraUSD.nonces(user.address)),
          paraUSDPermitDeadline
        );
        await expect(
          reserveStabilityPool.connect(someone).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            },

            {
              v: paraUSDPermitSignature.v,
              r: paraUSDPermitSignature.r,
              s: paraUSDPermitSignature.s,
            },
            paraUSDPermitDeadline
          )
        ).to.be.revertedWithCustomError(paraUSD, "ERC20InsufficientAllowance");
      });
      it("shouldn't revert permitLend if permit signature frontrunned", async function () {
        await paraUSD
          .connect(someone)
          .permit(
            user.address,
            reserveStabilityPool.target,
            principal,
            paraUSDPermitDeadline,
            paraUSDPermitSignature.v,
            paraUSDPermitSignature.r,
            paraUSDPermitSignature.s
          );

        let tokenId = 1;
        await expect(
          reserveStabilityPool.connect(user).permitLend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            priceFeedSignature,
            paraUSDPermitSignature,
            paraUSDPermitDeadline
          )
        )
          .to.emit(reserveStabilityPool, "Lend")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            ZeroHash,
            0n
          );
      });
    });
  });
  describe("Claim", function () {
    let principal = parseEther("1000");
    let priceFeed: PriceFeed;
    let priceFeedSignature: Signature;
    let coupon: number;
    let maturityTimestamp: number;
    let validBefore: number;
    let validAfter: number;
    let tokenId: number;
    let lendTimestamp: number;

    beforeEach(async function () {
      await paraUSD.connect(minter).mint(user.address, principal);
      const currentTimestamp = await time.latest();
      coupon = (5 * DENOMINATOR) / 100;
      maturityTimestamp = currentTimestamp + ONE_YEAR_TIMESTAMP; // 12 months
      validBefore = currentTimestamp + 60 * 60 * 24;
      validAfter = currentTimestamp - 60 * 60 * 24;
      priceFeed = {
        maturityTimestamp: maturityTimestamp,
        coupon: coupon,
        validBefore: validBefore,
        validAfter: validAfter,
      };
      priceFeedSignature = await signPriceFeed(
        reserveStabilityPool.target as string,
        verifierName,
        verifierVersion,
        verifierSigner,
        priceFeed
      );
      tokenId = 1;
      await paraUSD
        .connect(user)
        .approve(reserveStabilityPool.target, principal);
      await reserveStabilityPool.connect(user).lend(
        {
          beneficiary: user.address,
          principal: principal,
          partnerId: ZeroHash,
          partnerFeeBPS: 0,
        },
        priceFeed,
        {
          v: priceFeedSignature.v,
          r: priceFeedSignature.r,
          s: priceFeedSignature.s,
        }
      );
      lendTimestamp = await time.latest();
    });
    describe("claim", function () {
      it("should claim successfully with approve", async function () {
        const totalIncome =
          (principal *
            BigInt(coupon) *
            BigInt(priceFeed.maturityTimestamp - lendTimestamp)) /
          (BigInt(ONE_YEAR_TIMESTAMP) * BigInt(DENOMINATOR));

        await nonFungibleNotePosition
          .connect(user)
          .approve(reserveStabilityPool.target, tokenId);

        await time.increaseTo(maturityTimestamp + 1);
        expect(await reserveStabilityPool.isMaturityPassed(tokenId)).to.be.true;
        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        )
          .to.emit(reserveStabilityPool, "Claim")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            totalIncome,
            0,
            ZeroHash
          );

        expect(await paraUSD.balanceOf(user.address)).to.equal(
          principal + totalIncome
        );
        expect(await paraUSD.balanceOf(reserveStabilityPool.target)).to.equal(
          0
        );
        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          0
        );
        expect(
          await nonFungibleNotePosition.balanceOf(reserveStabilityPool.target)
        ).to.equal(0);

        await expect(nonFungibleNotePosition.ownerOf(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);
        await expect(nonFungibleNotePosition.getLendInfo(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);
      });
      it("should claim successfully with operator approval", async function () {
        const totalIncome =
          (principal *
            BigInt(coupon) *
            BigInt(priceFeed.maturityTimestamp - lendTimestamp)) /
          (BigInt(ONE_YEAR_TIMESTAMP) * BigInt(DENOMINATOR));

        await nonFungibleNotePosition
          .connect(user)
          .setApprovalForAll(reserveStabilityPool.target, true);

        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        )
          .to.emit(reserveStabilityPool, "Claim")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            totalIncome,
            0,
            ZeroHash
          );

        expect(await paraUSD.balanceOf(user.address)).to.equal(
          principal + totalIncome
        );
        expect(await paraUSD.balanceOf(reserveStabilityPool.target)).to.equal(
          0
        );
        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          0
        );
        expect(
          await nonFungibleNotePosition.balanceOf(reserveStabilityPool.target)
        ).to.equal(0);

        await expect(nonFungibleNotePosition.ownerOf(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);
        await expect(nonFungibleNotePosition.getLendInfo(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);
      });
      it("should revert claim if paused", async function () {
        await time.increaseTo(maturityTimestamp + 1);
        await reserveStabilityPool.connect(pauser).pause();
        await expect(
          reserveStabilityPool.isMaturityPassed(tokenId)
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
      });
      it("should revert claim if msg.sender is not owner", async function () {
        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(someone).claim(someone.address, tokenId)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__NotTokenOwner"
        );
      });
      it("should revert claim if maturityTimestamp is not passed", async function () {
        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__MaturityNotPassed"
        );
      });
      it("shouldn't enter fee mint if protocolFee is 0%", async function () {
        const totalIncome =
          (principal *
            BigInt(coupon) *
            BigInt(priceFeed.maturityTimestamp - lendTimestamp)) /
          (BigInt(ONE_YEAR_TIMESTAMP) * BigInt(DENOMINATOR));

        await nonFungibleNotePosition
          .connect(user)
          .approve(reserveStabilityPool.target, tokenId);

        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(user).claim(user.address, tokenId)
        )
          .to.emit(reserveStabilityPool, "Claim")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            totalIncome,
            0,
            ZeroHash
          );

        expect(await paraUSD.balanceOf(user.address)).to.equal(
          principal + totalIncome
        );
      });
    });
    describe("permitClaim", function () {
      let nfnpPermitSignature: Signature;
      let nfnpPermitDeadline: number;
      beforeEach(async function () {
        nfnpPermitDeadline = maturityTimestamp + 60 * 10; // 10 minutes
        nfnpPermitSignature = await signERC721Permit(
          nonFungibleNotePosition.target as string,
          nonFungibleNotePositionName,
          nonFungibleNotePositionVersion,
          user,
          reserveStabilityPool.target as string,
          tokenId,
          Number(await nonFungibleNotePosition.nonces(tokenId)),
          nfnpPermitDeadline
        );
      });
      it("should permitClaim successfully", async function () {
        const totalIncome =
          (principal *
            BigInt(coupon) *
            BigInt(priceFeed.maturityTimestamp - lendTimestamp)) /
          (BigInt(ONE_YEAR_TIMESTAMP) * BigInt(DENOMINATOR));

        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(user).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        )
          .to.emit(reserveStabilityPool, "Claim")
          .withArgs(
            user.address,
            user.address,
            tokenId,
            priceFeed.maturityTimestamp,
            priceFeed.coupon,
            principal,
            totalIncome,
            0,
            ZeroHash
          );

        expect(await paraUSD.balanceOf(user.address)).to.equal(
          principal + totalIncome
        );
        expect(await paraUSD.balanceOf(reserveStabilityPool.target)).to.equal(
          0
        );
        expect(await nonFungibleNotePosition.balanceOf(user.address)).to.equal(
          0
        );
        expect(
          await nonFungibleNotePosition.balanceOf(reserveStabilityPool.target)
        ).to.equal(0);

        await expect(nonFungibleNotePosition.ownerOf(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);
        await expect(nonFungibleNotePosition.getLendInfo(tokenId))
          .to.be.revertedWithCustomError(
            nonFungibleNotePosition,
            "ERC721NonexistentToken"
          )
          .withArgs(tokenId);
      });
      it("shouldn't revert permitClaim if permit signature frontrunned", async function () {
        await nonFungibleNotePosition
          .connect(someone)
          .permit(
            reserveStabilityPool.target,
            tokenId,
            nfnpPermitDeadline,
            nfnpPermitSignature.v,
            nfnpPermitSignature.r,
            nfnpPermitSignature.s
          );

        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(user).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.emit(reserveStabilityPool, "Claim");
      });
      it("should revert permitClaim if paused", async function () {
        await time.increaseTo(maturityTimestamp + 1);
        await reserveStabilityPool.connect(pauser).pause();
        await expect(
          reserveStabilityPool.isMaturityPassed(tokenId)
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
        await expect(
          reserveStabilityPool.connect(user).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
      });
      it("should revert permitClaim if msg.sender is not owner", async function () {
        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(someone).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__NotTokenOwner"
        );
      });
      it("should revert permitClaim if maturityTimestamp is not passed", async function () {
        await expect(
          reserveStabilityPool.connect(user).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__MaturityNotPassed"
        );
      });
      it("should revert permitClaim if permit is expired", async function () {
        await time.increaseTo(nfnpPermitDeadline + 1);
        await expect(
          reserveStabilityPool.connect(user).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "NonFungibleNotePosition__TokenNotApproved"
        );
      });
      it("should revert permitClaim if permit nonce is invalid", async function () {
        nfnpPermitSignature = await signERC721Permit(
          nonFungibleNotePosition.target as string,
          nonFungibleNotePositionName,
          nonFungibleNotePositionVersion,
          user,
          reserveStabilityPool.target as string,
          tokenId,
          Number(await nonFungibleNotePosition.nonces(tokenId)) + 1,
          nfnpPermitDeadline
        );
        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(user).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.be.revertedWithCustomError(
          nonFungibleNotePosition,
          "NonFungibleNotePosition__TokenNotApproved"
        );
      });
      it("should revert permitClaim if permit signed by another user", async function () {
        nfnpPermitSignature = await signERC721Permit(
          nonFungibleNotePosition.target as string,
          nonFungibleNotePositionName,
          nonFungibleNotePositionVersion,
          user,
          reserveStabilityPool.target as string,
          tokenId,
          Number(await nonFungibleNotePosition.nonces(tokenId)),
          nfnpPermitDeadline
        );
        await time.increaseTo(maturityTimestamp + 1);
        await expect(
          reserveStabilityPool.connect(someone).permitClaim(
            user.address,
            tokenId,
            {
              v: nfnpPermitSignature.v,
              r: nfnpPermitSignature.r,
              s: nfnpPermitSignature.s,
            },
            nfnpPermitDeadline
          )
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__NotTokenOwner"
        );
      });
    });
    describe("batchClaim", function () {
      it("should batchClaim successfully", async function () {
        const currentTimestamp = await time.latest();
        const { priceFeed, priceFeedSignature } =
          await createMockPriceFeedSignature(
            currentTimestamp,
            reserveStabilityPool,
            verifierSigner,
            verifierName,
            verifierVersion
          );
        const batchCount = 10;
        await paraUSD
          .connect(minter)
          .mint(user.address, principal * BigInt(batchCount));
        await paraUSD
          .connect(user)
          .approve(reserveStabilityPool.target, principal * BigInt(batchCount));
        for (let i = 0; i < batchCount; i++) {
          await reserveStabilityPool.connect(user).lend(
            {
              beneficiary: user.address,
              principal: principal,
              partnerId: ZeroHash,
              partnerFeeBPS: 0,
            },
            priceFeed,
            {
              v: priceFeedSignature.v,
              r: priceFeedSignature.r,
              s: priceFeedSignature.s,
            }
          );
        }
        await time.increaseTo(maturityTimestamp + 1);
        await nonFungibleNotePosition
          .connect(user)
          .setApprovalForAll(reserveStabilityPool.target, true);

        const result = await reserveStabilityPool
          .connect(user)
          .batchClaim.staticCall(
            Array.from({ length: batchCount }, () => user.address),
            Array.from({ length: batchCount }, (_, i) => i + 2)
          );

        await reserveStabilityPool.connect(user).batchClaim(
          Array.from({ length: batchCount }, () => user.address),
          Array.from({ length: batchCount }, (_, i) => i + 2)
        );
      });
      it("should revert batchClaim if array length mismatch", async function () {
        await expect(
          reserveStabilityPool
            .connect(user)
            .batchClaim([user.address, user.address], [tokenId])
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__ArrayLengthMismatch"
        );
      });
      it("should revert batchClaim if paused", async function () {
        await reserveStabilityPool.connect(pauser).pause();
        await expect(
          reserveStabilityPool
            .connect(user)
            .batchClaim([user.address], [tokenId])
        ).to.be.revertedWithCustomError(reserveStabilityPool, "EnforcedPause");
      });
    });
  });
  describe("Floating Income", function () {
    describe("updateDailyFloatingIncome", function () {
      let income: bigint;
      it("should updateDailyFloatingIncome successfully", async function () {
        income = parseEther("100");
        const currentTimestamp = await time.latest();
        const day = await reserveStabilityPool.getDay(currentTimestamp);
        await expect(
          reserveStabilityPool.connect(admin).updateDailyFloatingIncome(income)
        )
          .to.emit(reserveStabilityPool, "UpdateDailyFloatingIncome")
          .withArgs(day - 1n, income, income);
        expect(await reserveStabilityPool.accFloatingIncome(day - 1n)).to.eq(
          income
        );
      });
      it("should revert updateDailyFloatingIncome if someone try to execute", async function () {
        await expect(
          reserveStabilityPool
            .connect(someone)
            .updateDailyFloatingIncome(income)
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await reserveStabilityPool.FLOATING_INCOME_ROLE()
          );
      });
      it("should revert updateDailyFloatingIncome if already updated", async function () {
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await expect(
          reserveStabilityPool.connect(admin).updateDailyFloatingIncome(income)
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "ReserveStabilityPool__DailyFloatingIncomeAlreadyUpdated"
          )
          .withArgs();
      });
      it("should revert updateDailyFloatingIncome if previous day is not updated", async function () {
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await time.increase(ONE_DAY_TIMESTAMP * 2);
        await expect(
          reserveStabilityPool.connect(admin).updateDailyFloatingIncome(income)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__PreviousDayNotUpdated"
        );
      });
      it("should calculate accumulated floating income correct", async function () {
        income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        const currentTimestamp = await time.increase(ONE_DAY_TIMESTAMP);
        const day = await reserveStabilityPool.getDay(currentTimestamp);
        income = parseEther("200");
        await expect(
          reserveStabilityPool.connect(admin).updateDailyFloatingIncome(income)
        )
          .to.emit(reserveStabilityPool, "UpdateDailyFloatingIncome")
          .withArgs(day - 1n, income, parseEther("300"));
        expect(await reserveStabilityPool.accFloatingIncome(day - 1n)).to.eq(
          parseEther("300")
        );
      });
    });
    describe("updatePreviousFloatingIncome", function () {
      it("should updatePreviousFloatingIncome successfully", async function () {
        const currentTimestamp = await time.latest();
        const day = Number(await reserveStabilityPool.getDay(currentTimestamp));
        const incomes = [
          parseEther("100"),
          parseEther("200"),
          parseEther("300"),
        ];
        const updateDayCount = incomes.length;
        const firstDay = day - updateDayCount - 1;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(firstDay, updateDayCount, incomes)
        )
          .to.emit(reserveStabilityPool, "UpdatePreviousFloatingIncome")
          .withArgs(firstDay, incomes, [
            parseEther("100"),
            parseEther("300"),
            parseEther("600"),
          ]);
        expect(await reserveStabilityPool.accFloatingIncome(day - 2)).to.eq(
          parseEther("600")
        );
        expect(await reserveStabilityPool.lastFloatingIncomeUpdateDay()).to.eq(
          day - 2
        );
      });
      it("should revert updatePreviousFloatingIncome if someone try to execute", async function () {
        const currentTimestamp = await time.latest();
        const day = Number(await reserveStabilityPool.getDay(currentTimestamp));
        const incomes = [
          parseEther("100"),
          parseEther("200"),
          parseEther("300"),
        ];
        const updateDayCount = incomes.length;
        const firstDay = day - updateDayCount - 1;
        await expect(
          reserveStabilityPool
            .connect(someone)
            .updatePreviousFloatingIncome(firstDay, updateDayCount, incomes)
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "AccessControlUnauthorizedAccount"
          )
          .withArgs(
            someone.address,
            await reserveStabilityPool.FLOATING_INCOME_ROLE()
          );
      });
      it("should revert updatePreviousFloatingIncome firstDay or dayCount is 0", async function () {
        const incomes = [
          parseEther("100"),
          parseEther("200"),
          parseEther("300"),
        ];
        const updateDayCount = incomes.length;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(0, updateDayCount, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__InvalidInputParameter"
        );
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(1, 0, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__InvalidInputParameter"
        );
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(0, 0, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__InvalidInputParameter"
        );
      });
      it("should revert updatePreviousFloatingIncome dayCount not match with array length", async function () {
        const incomes = [
          parseEther("100"),
          parseEther("200"),
          parseEther("300"),
        ];
        const updateDayCount = incomes.length - 1;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(1, updateDayCount, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__ArrayLengthMismatch"
        );
      });
      it("should revert updatePreviousFloatingIncome if lastUpdateDay greater than currentDay ", async function () {
        const income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);

        await time.increase(ONE_DAY_TIMESTAMP);
        const currentTimestamp = await time.latest();
        const currentDay = Number(
          await reserveStabilityPool.getDay(currentTimestamp)
        );
        const incomes = [parseEther("100"), parseEther("200")];
        const updateDayCount = incomes.length;
        const firstDay = currentDay - updateDayCount + 1;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(firstDay, updateDayCount, incomes)
        )
          .to.be.revertedWithCustomError(
            reserveStabilityPool,
            "ReserveStabilityPool__UpdateDayIsNotValid"
          )
          .withArgs(firstDay + updateDayCount - 1);
      });
      it("should revert if previous last update data is less then the latest updated data", async function () {
        const income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);

        const currentTimestamp = await time.latest();
        const currentDay = Number(
          await reserveStabilityPool.getDay(currentTimestamp)
        );
        const incomes = [parseEther("100"), parseEther("200")];
        const updateDayCount = incomes.length;
        const firstDay = currentDay - updateDayCount - 1;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(firstDay, updateDayCount, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__FloatingIncomeNotSynced"
        );
      });
      it("should revert if last update day greather then the next day", async function () {
        let income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        const firstUpdateDay =
          await reserveStabilityPool.lastFloatingIncomeUpdateDay();
        await time.increase(ONE_DAY_TIMESTAMP);
        income = parseEther("200");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await time.increase(ONE_DAY_TIMESTAMP);
        income = parseEther("300");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        const incomes = [parseEther("100"), parseEther("501")];
        const dayCount = incomes.length;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(firstUpdateDay, dayCount, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__FloatingIncomeNotSynced"
        );
      });
      it("should revert if first day greather then the lastUpdateDay", async function () {
        let income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await time.increase(ONE_DAY_TIMESTAMP);
        income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await time.increase(ONE_DAY_TIMESTAMP);
        income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);

        await time.increase(ONE_DAY_TIMESTAMP * 3);

        const firstUpdateTimestamp = await time.latest();
        const firstUpdateDay =
          (await reserveStabilityPool.getDay(firstUpdateTimestamp)) - 2n;
        const incomes = [parseEther("100"), parseEther("300")];
        const dayCount = incomes.length;
        await expect(
          reserveStabilityPool
            .connect(admin)
            .updatePreviousFloatingIncome(firstUpdateDay, dayCount, incomes)
        ).to.be.revertedWithCustomError(
          reserveStabilityPool,
          "ReserveStabilityPool__FloatingIncomeNotSynced"
        );
      });
      it("should updatePreviousFloatingIncome successfully if lastFloatingIncomeUpdateDay is current day - 1", async function () {
        // Setup initial state
        const income = parseEther("100");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        const firstDay =
          await reserveStabilityPool.lastFloatingIncomeUpdateDay();

        await time.increase(ONE_DAY_TIMESTAMP);
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        // 1-100, 2-200,
        await time.increase(ONE_DAY_TIMESTAMP * 2);
        // 1-100, 2-200, 3-0, 4-0,
        const currentTimestamp = await time.latest();
        const currentDay = await reserveStabilityPool.getDay(currentTimestamp); // 4

        // Ensure day after last update has zero income
        const incomes = [parseEther("100"), parseEther("100")];
        const updateDayCount = incomes.length;
        const lastUpdateDay = currentDay - BigInt(updateDayCount) + 1n;

        // Attempt update
        await reserveStabilityPool
          .connect(admin)
          .updatePreviousFloatingIncome(firstDay, updateDayCount, incomes);
      });

      // it("should updatePreviousFloatingIncome successfully in batches to avoid out of gas", async function () {
      //   // Setup initial state
      //   const income = parseEther("100");
      //   await reserveStabilityPool
      //     .connect(admin)
      //     .updateDailyFloatingIncome(income);
      //   const firstDay =
      //     await reserveStabilityPool.lastFloatingIncomeUpdateDay();

      //   await time.increase(ONE_DAY_TIMESTAMP * 3);
      //   // 1-100, 2-0, 3-0, 4-0,
      //   const incomes = [parseEther("100"), parseEther("100")];
      //   const updateDayCount = incomes.length;
      //   await reserveStabilityPool
      //     .connect(admin)
      //     .updatePreviousFloatingIncome(firstDay + 1n, updateDayCount, incomes);
      //   await reserveStabilityPool
      //     .connect(admin)
      //     .updatePreviousFloatingIncome(firstDay + 3n, 1n, [parseEther("100")]);
      // });
      // it("should learn how much data can be updated in once", async function () {
      //   const firstDay = await reserveStabilityPool.getDay(await time.latest());
      //   const income = parseEther("100");
      //   let i = 1;
      //   while (true) {
      //     try {
      //       const _incomes = new Array(i).fill(income);
      //       await reserveStabilityPool
      //         .connect(admin)
      //         .updatePreviousFloatingIncome(firstDay - BigInt(i), i, _incomes);
      //       i++;
      //     } catch (e) {
      //       console.log(e);
      //       console.log("i", i);
      //       break;
      //     }
      //   }
      // }).timeout(1000000);
      it("should updatePreviousFloatingIncome successfully if last update day less then or equal to the next day", async function () {
        let income = parseEther("100");
        const firstUpdateTimestamp = await time.latest();
        const firstUpdateDay = await reserveStabilityPool.getDay(
          firstUpdateTimestamp
        );

        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await time.increase(ONE_DAY_TIMESTAMP);
        income = parseEther("200");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);
        await time.increase(ONE_DAY_TIMESTAMP);
        income = parseEther("300");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);

        const incomes = [parseEther("100"), parseEther("200")];
        const dayCount = incomes.length;
        await reserveStabilityPool
          .connect(admin)
          .updatePreviousFloatingIncome(firstUpdateDay - 1n, dayCount, incomes);
      });
    });

    describe("floating income calculation", function () {
      let user1TokenId: number;
      let user2TokenId: number;
      let user1Principal: bigint;
      let user2Principal: bigint;
      let user1LendTimestamp: number;
      let user2LendTimestamp: number;
      let priceFeed: PriceFeed;
      beforeEach(async function () {
        user1Principal = parseEther("1000");
        user2Principal = parseEther("2000");
        await paraUSD.connect(minter).mint(user.address, user1Principal);
        await paraUSD.connect(minter).mint(user2.address, user2Principal);

        const currentTimestamp = await time.latest();
        const maturityTimestamp = currentTimestamp + ONE_DAY_TIMESTAMP * 7;
        const coupon = (5 * DENOMINATOR) / 100;
        const validBefore = currentTimestamp + 60 * 60 * 24;
        const validAfter = currentTimestamp - 60 * 60 * 24;
        priceFeed = {
          maturityTimestamp: maturityTimestamp,
          coupon: coupon,
          validBefore: validBefore,
          validAfter: validAfter,
        };
        const priceFeedSignature = await signPriceFeed(
          reserveStabilityPool.target as string,
          verifierName,
          verifierVersion,
          verifierSigner,
          priceFeed
        );
        await paraUSD
          .connect(user)
          .approve(reserveStabilityPool.target, user1Principal);
        await paraUSD
          .connect(user2)
          .approve(reserveStabilityPool.target, user2Principal);
        await reserveStabilityPool.connect(user).lend(
          {
            beneficiary: user.address,
            principal: user1Principal,
            partnerId: ZeroHash,
            partnerFeeBPS: 0,
          },
          priceFeed,
          {
            v: priceFeedSignature.v,
            r: priceFeedSignature.r,
            s: priceFeedSignature.s,
          }
        );
        user1LendTimestamp = await time.latest();
        await reserveStabilityPool.connect(user2).lend(
          {
            beneficiary: user2.address,
            principal: user2Principal,
            partnerId: ZeroHash,
            partnerFeeBPS: 0,
          },
          priceFeed,
          {
            v: priceFeedSignature.v,
            r: priceFeedSignature.r,
            s: priceFeedSignature.s,
          }
        );
        user2LendTimestamp = await time.latest();
        user1TokenId = 1;
        user2TokenId = 2;
      });
      it("should updateDailyFloatingIncome and calculateFloating income successfully", async function () {
        await time.increase(ONE_DAY_TIMESTAMP);
        let income = parseEther("10");
        await reserveStabilityPool
          .connect(admin)
          .updateDailyFloatingIncome(income);

        const user1LendDay = await reserveStabilityPool.getDay(
          user1LendTimestamp
        );
        const user1LendDayIncome = await reserveStabilityPool.accFloatingIncome(
          user1LendDay
        );
        const user1LendDaySeconds =
          (user1LendDay + 1n) * BigInt(ONE_DAY_TIMESTAMP) -
          BigInt(user1LendTimestamp);
        const user1TotalIncome =
          (user1LendDaySeconds * user1LendDayIncome * user1Principal) /
          EXACT_1e25;
        expect(
          await reserveStabilityPool.calculateFloatingIncome(user1TokenId)
        ).to.be.eq(user1TotalIncome);

        const user2LendDay = await reserveStabilityPool.getDay(
          user2LendTimestamp
        );
        const user2LendDayIncome = await reserveStabilityPool.accFloatingIncome(
          user2LendDay
        );
        const user2LendDaySeconds =
          (user2LendDay + 1n) * BigInt(ONE_DAY_TIMESTAMP) -
          BigInt(user2LendTimestamp);
        const user2TotalIncome =
          (user2LendDaySeconds * user2LendDayIncome * user2Principal) /
          EXACT_1e25;
        expect(
          await reserveStabilityPool.calculateFloatingIncome(user2TokenId)
        ).to.be.eq(user2TotalIncome);
      });
    });
  });
});
