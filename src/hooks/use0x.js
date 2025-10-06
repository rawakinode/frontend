
// NOTE: Pastikan endpoint 0x API support Monad testnet. Jika tidak, gunakan aggregator/endpoint lain.
// chainId Monad testnet = 201804 (lihat wagmi/viem config)

import { zeroAddress } from "viem";

// Fungsi ini siap dipakai dengan viem dan wagmi di jaringan Monad testnet
export async function getQuote({
    chainId = 201804, // Monad testnet
    sellToken,
    buyToken,
    sellAmount,
    taker,
    apiKey = '',
    version = 'v2',
    endpoint = 'https://api.0x.org/swap/permit2/quote', // override jika ada endpoint testnet
} = {}) {
    if (!sellToken || !buyToken || !sellAmount || !taker) {
        throw new Error('sellToken, buyToken, sellAmount, and taker are required');
    }
    const url = `${endpoint}?chainId=${chainId}&sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}&taker=${taker}`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                '0x-api-key': apiKey,
                '0x-version': version,
            },
        });
        if (!res.ok) {
            throw new Error(`0x API error: ${res.status}`);
        }
        return await res.json();
    } catch (error) {
        console.error('getQuote error:', error);
        throw error;
    }
}

export async function coba(address) {
    const quote = await getQuote({
        sellToken: zeroAddress, // MON
        buyToken: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea', // contoh token
        sellAmount: '100000000000000', // 0.01 MON dalam wei
        taker: address,
        apiKey: '211e9fe3-2ebc-4fd9-aef9-860b3e87f821', // ganti dengan API key Anda
    });
    console.log(quote);
}