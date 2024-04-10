## Description

This Git project hosts a sell-bot designed to facilitate asset trading on the DeFiChain platform. Using the platform's distinct layers including the Defichain Virtual Machine (DVM) layer, Ethereum Virtual Machine (EVM) layer, and a Hybrid Layer via TransferDomain, this bot streamlines the process of swapping assets.

## Features:

-   Automated Selling: The bot automates the selling process, providing convenience and efficiency to users.
-   DeFiChain Integration: Seamlessly integrates with DeFiChain, ensuring compatibility and reliability.
-   Multi-Layer Support: Supports trading across various layers including DVM, EVM, and Hybrid Layer via TransferDomain, widening the scope of asset trading possibilities.
-   Customizable Settings: Users can configure settings to tailor the bot's behavior according to their preferences.
-   Real-Time Updates: Provides real-time updates on market conditions, ensuring informed decision-making.

## Installation

```bash
$ npm install
```

## Environment

```
SEED='["", "", ...]'
FROM_TOKEN_NAME='DUSD'
FROM_TOKEN_AMOUNT=10
TO_TOKEN_NAME='BTC'
TO_TOKEN_ADDRESS_DVM='df...'
TO_TOKEN_ADDRESS_EVM='0x...'
MIN_PRICE=0.00000500
THRESHOLD_TRANSFERDOMAIN=0.01
INTERVALSEC=600 	# every 10min
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Execution

Run the bot to start automated selling based on your configured parameters.

## Monitoring

Keep track of the bot's performance and adjust settings as necessary for optimal results.

## Support

Thanks for supporting us.

# Disclaimer: Research and Proof of Concept Development

This repository is dedicated to research and proof of concept (PoC) development purposes. The materials contained herein may include experimental code, documentation, datasets, and other resources aimed at exploring novel ideas, technologies, or methodologies. It is important to understand the following:

### Experimental Nature: 
The contents of this repository are experimental and may not be suitable for production use. They are provided as-is, without any warranty, expressed or implied. The code, documentation, and other materials may be incomplete, contain errors, or lack optimization.

### No Guarantees: 
While efforts have been made to ensure the accuracy and reliability of the materials provided, no guarantees are made regarding their correctness, completeness, or suitability for any particular purpose. Users are encouraged to review and verify all information independently.

### Limited Support: 
Support for the contents of this repository may be limited or unavailable. Contributors to this repository may provide assistance on a best-effort basis, but there is no obligation to do so. Users are encouraged to collaborate and share insights within the community.

### Not Legal Advice: 
Any information, including but not limited to legal, regulatory, or compliance-related guidance, provided within this repository is for informational purposes only. It does not constitute legal advice or a substitute for professional consultation. Users should consult appropriate experts for specific legal matters.

### Use at Your Own Risk: 
The use of any materials from this repository is at your own risk. The contributors to this repository shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from the use of, or inability to use, the materials provided herein.

By accessing or using any materials within this repository, you agree to these terms and conditions. If you do not agree with these terms, you should not access or use the contents of this repository. This disclaimer is subject to change without notice.
