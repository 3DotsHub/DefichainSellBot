import { WhaleApiClientOptions } from '@defichain/whale-api-client';
import { MainNet, TestNet, Network } from '@defichain/jellyfish-network';
import { Token, ChainId } from '@uniswap/sdk-core';

// network and url
export const selectedNetwork: WhaleApiClientOptions['network'] = 'mainnet';
export const selectedNetworkObject: Network = MainNet;
export const oceanUrl = {
	mainnet: 'https://ocean.mydefichain.com',
	testnet: 'https://testnet.ocean.jellyfishsdk.com',
};
export const dmcUrl = 'https://dmc.mydefichain.com/';
export const DMCChainId = 1130 as ChainId;

// contract addresses
export const VanillaSwapRouterV2Addr = '0x3E8C92491fc73390166BA00725B8F5BD734B8fba';

// defichain standard tokens
export const WDFI_DST = new Token(DMCChainId, '0x49febbF9626B2D39aBa11C01d83Ef59b3D56d2A4', 18, 'WDFI', 'Wrapped DFI');
export const DUSD_DST = new Token(DMCChainId, '0xFf0000000000000000000000000000000000000F', 18, 'DUSD', 'Decentralized US-Dollar');
export const BTC_DST = new Token(DMCChainId, '0xff00000000000000000000000000000000000002', 18, 'BTC', 'Bitcoin');
