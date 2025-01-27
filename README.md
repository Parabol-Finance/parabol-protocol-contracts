<img width="1500" alt="README Cover" src="https://github.com/Parabol-Finance/parabol-monorepo/assets/67913214/7e5416f5-c884-4cff-a33a-9f24c702de81">

# Parabol Protocol Contracts

## Description

**Parabol Protocol Contracts** power Parabol, a permissionless system enabling paraUSD lenders to access **“risk-free rates and beyond”** through **Reserve Stability Pool (RSP)**. This maturity-matched mechanism allows paraUSD holders to make bilateral loans with a fixed and predictable return (**fixed income**) and market-driven variable return (**floating income**) based on the protocol's Marginal Market Rate (MMR).

By lending paraUSD to RSP, users remove paraUSD from redeemable circulation for the loan duration, providing unmatched stability and resiliency to Parabol’s Reserve Assets. The protocol employs advanced mechanisms like duration-matched loans and real-time income accrual to deliver superior yield opportunities for users and partners alike.

For a deeper understanding, visit the [official documentation](https://docs.parabol.fi):

#### Key Concepts:

- [Reserve Stability Pool](https://docs.parabol.fi/getting-started/concept#reserve-stability-pool) – Mechanism managing maturity-matched Reserve Assets.
- [Fixed Income](https://docs.parabol.fi/getting-started/concept#fixed-income) – Stable returns based on lending terms.
- [Floating Income](https://docs.parabol.fi/getting-started/concept#floating-income) – Additional variable returns updated daily.

---

## Features

- **Dual-Yield Income**: Simultaneously earn:
  - **Fixed Income**: A predetermined yield set using the T-Bill rate and locked at the time of lending.
  - **Floating Income**: A variable yield, updated daily, tied to the overnight repo market and dependent on pool utilization.
- **Permissionless Lending**: paraUSD holders can make bilateral loans at a chosen maturity and rate, with a minimum loan threshold of **1,000 paraUSD**.
- **Marginal Market Rate (MMR)**: The protocol constantly broadcasts the MMR, combining a floating rate and risk-free floor derived from pool utilization and external factors.
- **ERC-721 Tokenized Notes**: Deposits are represented as NFTs, enabling lenders to transparently track and manage positions.
- **Gasless Approvals**: Support for EIP-2612 enables seamless, gas-free approvals for lending and claiming.
- **Secure and Upgradeable**: Built with modular architecture and role-based controls to ensure adaptability and robustness.
- **Audit Verified**: Fully audited by trusted third parties; see reports [here](https://github.com/parabol-finance/parabol-protocol-contracts/tree/main/audits).

---

## Installation Instructions

### Prerequisites

1. Install **Node.js** (v16 or later).
2. Install **Hardhat**, a versatile Ethereum smart contract framework:
   ```bash
   npm install --save-dev hardhat
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

---

### Cloning the Repository

Clone the official repository:

```bash
git clone https://github.com/parabol-finance/parabol-protocol-contracts.git
cd parabol-protocol-contracts
```

---

## Smart Contract Details

---

## Smart Contract Details

### Reserve Stability Pool (RSP)

The **Reserve Stability Pool (RSP)** is the core mechanism of the Parabol Protocol. It allows paraUSD holders to lend funds at a maturity of their choice, earning **fixed income** (determined during lending) and **floating income** (updated daily at **09:10 UTC**). The RSP enables maturity-matched Reserve Asset management, ensuring unmatched resiliency compared to traditional stablecoin systems.

#### Structs:

- **`LendParams`**:

  - `beneficiary`: Address for which the note is created, receiving income allocations.
  - `partnerId`: Identifier for the lending partner facilitating the loan.
  - `partnerFeeBPS`: Fee (in basis points) charged by the lending partner.
  - `principal`: The principal amount lent in paraUSD.

- **`PriceFeed`**:

  - `price`: Current paraUSD price provided by an off-chain oracle.
  - `timestamp`: Timestamp when the price feed was generated.

- **`Signature`**:
  - `v`: Recovery byte of the ECDSA signature.
  - `r` and `s`: Cryptographic components of the signature.

#### Key Functions:

1. **`lend(LendParams calldata lendParams, PriceFeed calldata priceFeed, Signature calldata feedSignature)`**  
   Initiates a lending operation based on the provided parameters.

   - **Parameters**:
     - `lendParams`: Struct containing lending details.
     - `priceFeed`: Struct containing off-chain paraUSD price data.
     - `feedSignature`: Cryptographic signature verifying the price feed validity.
   - Emits:
     - `Lend` event.

2. **`claim(address beneficiary, uint256 tokenId)`**  
   Enables users to claim their principal and accumulated income (both fixed and floating) after the maturity period.

   - **Parameters**:
     - `beneficiary`: Address to receive claimed funds.
     - `tokenId`: ID of the ERC-721 note representing the lending position.
   - Emits:
     - `Claim` event.

3. **`permitLend(LendParams calldata lendParams, PriceFeed calldata priceFeed, Signature calldata feedSignature, Signature calldata permitSignature, uint256 permitDeadline)`**  
   Facilitates gasless lending by using an off-chain EIP-2612 signature to authorize the transaction.

   - **Parameters**:
     - `lendParams`: Struct containing lending details.
     - `priceFeed`: Struct containing off-chain paraUSD price data.
     - `feedSignature`: Cryptographic signature verifying the price feed validity.
     - `permitSignature`: EIP-2612 signature for lending.
     - `permitDeadline`: Deadline after which the signature is invalid.
   - Emits:
     - `Lend` event.

4. **`permitClaim(address beneficiary, uint256 tokenId, Signature calldata permitSignature, uint256 permitDeadline)`**  
   Enables gasless claiming using an off-chain EIP-2612 signature.

   - **Parameters**:
     - `beneficiary`: Address to receive claimed funds.
     - `tokenId`: ID of the ERC-721 note being claimed.
     - `permitSignature`: EIP-2612 signature for approval.
     - `permitDeadline`: Deadline after which the signature is invalid.
   - Emits:
     - `Claim` event.

5. **`batchClaim(address[] calldata beneficiaries, uint256[] calldata tokenIds)`**  
   Enables batch claiming of multiple notes, consolidating principal and income claims into a single transaction.
   - **Parameters**:
     - `beneficiaries`: Array of addresses to receive claimed funds.
     - `tokenIds`: Array of IDs corresponding to multiple ERC-721 notes.

---

### ParabolUSD (Stablecoin)

**ParabolUSD (paraUSD)** is an ERC-20 token pegged 1:1 with the US Dollar. It is the primary currency used across the protocol for lending, claiming, and other operations. The contract allows minting and burning by authorized entities and integrates denylist functionality for enhanced security.

#### Key Functions:

1. **`mint(address to, uint256 amount)`**  
   Mints new paraUSD tokens to a specified address.

   - **Parameters**:
     - `to`: Address to receive minted tokens.
     - `amount`: Number of tokens to mint.
   - Emits:
     - `Mint` event.

2. **`burn(address from, uint256 amount)`**  
   Burns paraUSD tokens from a specified address, removing them from circulation.

   - **Parameters**:
     - `from`: Address from which tokens are burned.
     - `amount`: Number of tokens to burn.
   - Emits:
     - `Burn` event.

3. **`updateDenylister(address newDenylister)`**  
   Updates the address of the Denylister contract.
   - **Parameters**:
     - `newDenylister`: Address of the new Denylister contract.
   - Emits:
     - `DenylisterUpdated` event.

---

### NonFungibleNotePosition (ERC-721 Notes)

The **NonFungibleNotePosition** contract tokenizes lending positions into transferable ERC-721 notes, representing key information about each deposit, including maturity, income allocation, and partner details.

#### Structs:

- **`Note`**:
  - `lendTimestamp`: Timestamp when the lending began.
  - `maturityTimestamp`: Timestamp when the position matures.
  - `coupon`: Fixed coupon rate for the lending position.
  - `principal`: Principal amount lent in paraUSD.
  - `partnerFeeBPS`: Fee charged by the partner, in basis points.
  - `partnerId`: Identifier for the lending partner.

#### Key Functions:

1. **`mint(address to, Note calldata note)`**  
   Mints a new ERC-721 note to represent a user's lending position.

   - **Parameters**:
     - `to`: Address to receive the minted note.
     - `note`: Struct containing lending details (e.g., `principal`, `maturityTimestamp`).
   - Emits:
     - `Mint` event.

2. **`burn(uint256 tokenId)`**  
   Burns an ERC-721 note after the associated lending position is claimed or terminated.

   - **Parameters**:
     - `tokenId`: ID of the note to burn.
   - Emits:
     - `Burn` event.

3. **`getLendInfo(uint256 tokenId)`**  
   Retrieves the lending details for a specific ERC-721 note.
   - **Parameters**:
     - `tokenId`: ID of the note to query.
   - **Returns**:
     - Struct containing details such as `principal`, `coupon`, and `maturityTimestamp`.

---

### Denylister

The **Denylister** contract provides administrative tools to manage a denylist of addresses. This denylist is essential for ensuring compliance and security within the Parabol Protocol by allowing the protocol owner to block malicious or unauthorized accounts.

#### Key Functions:

1. **`addToDenylist(address account)`**  
   Adds a single account to the denylist.

   - **Parameters**:
     - `account`: The address to be denylisted.
   - Emits:
     - `AddedToDenylist(address account)` event.

2. **`batchAddToDenylist(address[] calldata accounts)`**  
   Adds multiple addresses to the denylist in one operation, improving efficiency for bulk updates.

   - **Parameters**:
     - `accounts`: An array of addresses to be added to the denylist.
   - Emits:
     - `AddedToDenylist(address account)` event for each denylisted address.

3. **`removeFromDenylist(address account)`**  
   Removes a single account from the denylist.

   - **Parameters**:
     - `account`: The address to be removed from the denylist.
   - Emits:
     - `RemovedFromDenylist(address account)` event.

4. **`batchRemoveFromDenylist(address[] calldata accounts)`**  
   Removes multiple addresses from the denylist in one operation.

   - **Parameters**:
     - `accounts`: An array of addresses to be removed from the denylist.
   - Emits:
     - `RemovedFromDenylist(address account)` event for each address removed.

5. **`isDenylisted(address account)`**  
   Checks whether a specific address is on the denylist.
   - **Parameters**:
     - `account`: The address to check.
   - **Returns**:
     - `bool`: Returns `true` if the address is denylisted, otherwise `false`.

---

#### Relevant Events:

- **`AddedToDenylist`**  
  Emitted when an address is added to the denylist.

  - **Parameters**:
    - `account`: The address that was added to the denylist.

- **`RemovedFromDenylist`**  
  Emitted when an address is removed from the denylist.
  - **Parameters**:
    - `account`: The address that was removed from the denylist.

## Interactions

### Lend paraUSD to ReserveStabilityPool:

Users can lend paraUSD to RSP, specifying their desired maturity. Fixed income is determined upfront, while floating income accrues daily.

```javascript
const [signer] = await ethers.getSigners();

const paraUSD = await ethers.getContractAt(
  "ParabolUSD",
  "0x1f94d6A61973eDf53252b9E61c6250F303957b9D"
);
const rsp = await ethers.getContractAt(
  "ReserveStabilityPool",
  "0x529d825EBFeFd66B80aC02609c0Fbd9EaaDD6781"
);

const principal = "1000000000000000000000"; // 1000 paraUSD

const approveTx = await paraUSD.connect(signer).approve(rsp.target, principal);
await approveTx.wait();

const lendParams = {
  beneficiary: signer.address,
  partnerId:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  partnerFeeBPS: 0,
  principal: principal,
};

const priceFeed = {
  maturityTimestamp: 1739314800,
  coupon: 401,
  validAfter: 1737521999,
  validBefore: 1737586799,
};

const priceFeedSignature = {
  v: 27,
  r: "0x123",
  s: "0x123",
};

const lendTx = await rsp
  .connect(signer)
  .lend(lendParams, priceFeed, priceFeedSignature);
await lendTx.wait();
```

To access price feed and priceFeedSignature variables you should get an api key from Parabol and fetch available notes to lend using the query below:

```bash
curl -X GET \
 'https://api.parabol.fi/notes' \
 -H 'Content-Type: application/json' \
 -H 'x-api-key: <PARABOL_API_KEY>'
```

### Claim Income After Maturity:

Once the loan matures, users can claim both the principal and accumulated income (fixed + floating):

```javascript
const [signer] = await ethers.getSigners();

const nfnp = await ethers.getContractAt(
  "NonFungibleNotePosition",
  "0xB04c71183F7Ee2551F405CCd77ee96f14B75ac4f"
);
const rsp = await ethers.getContractAt(
  "ReserveStabilityPool",
  "0x529d825EBFeFd66B80aC02609c0Fbd9EaaDD6781"
);

const tokenId = "1";

const approveTx = await nfnp.connect(signer).approve(rsp.target, tokenId);
await approveTx.wait();

const claimTx = await rsp.connect(signer).claim(signer.address, tokenId);
await claimTx.wait();
```

---

## Fixed Income Calculation

Fixed income accrues predictably and is calculated at the time of **claiming** after maturity. The formula is:

```text
Fixed Income = (principal * coupon * (maturityTimestamp - lendTimestamp)) / (10000 * 31104000)
```

Where:

- **principal**: The amount lent (in wei).
- **coupon**: Fixed yield rate (in basis points).
- **maturityTimestamp** & **lendTimestamp**: Loan start and maturity times in Unix format.
- **31104000**: The number of seconds in a year (360 days).

---

## Floating Income Calculation

Floating income accrues daily and consists of:

1. **Lend Day Income**
2. **Maturity Day Income**
3. **Remaining Days Income**

Floating income is recalculated every day and reflects pool utilization and the repo market performance.

```text
Floating Income = (lastDayAccFloatingIncome - lendDayAccFloatingIncome) * principal * 86400 / 1e25;
```

Where:

- **principal**: The amount lent (in wei).
- **lastDayAccFloatingIncome**: Accumulated floating income value at the day of maturity.
- **lendDayAccFloatingIncome**: Accumulated floating income value at the day of lend.
- **86400**: The number of seconds in a day (360 days).
- **1e25**: The value to scale floating income value for precise calculation.

---

## Testing

Run the test suite to validate the contract functionality:

```bash
npm run test
```

---

## Coverage

Evaluate test coverage:

```bash
npm run coverage
```

---

## Deployment Details

- **Networks**: Base
- **Contract Addresses**:
  - ParabolUSD: `0x1f94d6A61973eDf53252b9E61c6250F303957b9D`
  - ReserveStabilityPool: `0x529d825EBFeFd66B80aC02609c0Fbd9EaaDD6781`
  - NonFungibleNotePosition: `0xB04c71183F7Ee2551F405CCd77ee96f14B75ac4f`
  - Denylister: `0x6339659f57D3dC56d0a7F1DE3e9B62Dd54C8f41B`

---

## Audits

The Parabol Protocol Contracts have been thoroughly audited for security and reliability. Access audit reports [here](https://github.com/parabol-finance/parabol-protocol-contracts/tree/main/audits).

---

## License

Parabol Protocol Contracts is licensed under the Business Source License 1.1 (**BUSL-1.1**), see [LICENSE](https://github.com/Parabol-Finance/parabol-protocol-contracts/blob/main/LICENSE), and the GNU General Public License v2.0 or later (**GPL-2.0-or-later**), see [GPL_LICENSE](https://github.com/Parabol-Finance/parabol-protocol-contracts/blob/main/GPL_LICENSE). Each file in Parabol Protocol Contracts states the applicable license type in the header.
