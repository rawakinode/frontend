import { API_URL } from "@/config/api";
import axios from "axios";

export function defaultSwapFromTo() {
    const data = [
        {
            "address": "0x0000000000000000000000000000000000000000",
            "name": "Monad",
            "symbol": "MON",
            "decimals": "18",
            "balance": "0.00",
            "mon_per_token": "0",
            "usd_per_token": "0",
            "image_url": "0",
            "description": "0"
        },
        {
            "address": "0xf817257fed379853cde0fa4f97ab987181b1e5ea",
            "name": "USD Coin",
            "symbol": "USDC",
            "decimals": "6",
            "balance": "0.00",
            "mon_per_token": "0",
            "usd_per_token": "0",
            "image_url": "0",
            "description": "0"
        },
    ]
    return data;
}

export async function getVerifiedTokenWithBalance(address) {
    try {
        let wallet = "";
        if (address != undefined) {
            wallet = `&address=${address}`;
        }
        const response = await axios.get(`${API_URL}/verified_token?address=${wallet}`);
        return response.data;
    } catch (error) {
        console.log(error);
        return null;
    }
}

export async function getSwapQuote(from, to, amount, slippage, deadline, sender) {
    try {
        if (Number(amount) <= 0) return {};

        let url = `${API_URL}/get_quote?from=${from}&to=${to}&amount=${amount}&slippage=${slippage}&deadline=${deadline}`;
        if (sender) {
            url += `&sender=${sender}`;
        }

        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(error);
        return {};
    }
}

export async function getBalances(address, token) {
    try {
        const response = await axios.get(`${API_URL}/balance/${address}?token=${token}`);
        const item = response.data;
        return item ? item.balance : "0";
    } catch (error) {
        console.log(error);
        return "0";
    }
}

export async function getBalancesAllToken(address) {
    try {
        const response = await axios.get(`${API_URL}/all_balance_wallet/${address}`);
        return response.data;
    } catch (error) {
        console.log(error);
        return [];
    }
}