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
