import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_URL } from "@/config/api";

const API_BASE = API_URL;
const STORAGE_KEY = "jwt_token";

export function useAPI() {

    // Ambil token & expiry dari localStorage saat init
    const [tokenData, setTokenData] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : { token: null, expiresAt: 0 };
    });

    const { token, expiresAt } = tokenData;

    // In useAPI hook
    const tokenRef = useRef(token);

    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    // Auto-remove token kalau sudah expired
    useEffect(() => {
        if (!token) return;

        const now = Date.now();
        if (expiresAt <= now) {
            setTokenData({ token: null, expiresAt: 0 });
            localStorage.removeItem(STORAGE_KEY);
        } else {
            const timeout = setTimeout(() => {
                setTokenData({ token: null, expiresAt: 0 });
                localStorage.removeItem(STORAGE_KEY);
            }, expiresAt - now);

            return () => clearTimeout(timeout);
        }
    }, [token, expiresAt]);

    // --- AUTH ---
    const getNonce = async (address) => {
        const res = await axios.post(`${API_BASE}/api/auth/nonce`, { address });
        return res.data; // { nonce, message, address }
    };

    const login = async ({ address, signature, nonce }) => {
        const res = await axios.post(`${API_BASE}/api/auth`, { address, signature, nonce });

        const token = res.data.token;
        const expiresAt = Date.now() + (res.data.expiresIn || 3600000);

        setTokenData({ token, expiresAt });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }));

        return { token, expiresAt, ...res.data }; // 🔑 return token langsung
    };

    const logout = () => {
        setTokenData({ token: null, expiresAt: 0 });
        localStorage.removeItem(STORAGE_KEY);
    };

    const getUserData = async (overrideToken) => {
        const authToken = overrideToken || token;
        if (!authToken) throw new Error("User not authenticated");

        const res = await axios.get(`${API_BASE}/api/userdata`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        return res.data;
    };

    const postDelegationData = async (delegationData) => {
        const authToken = token;
        if (!authToken) throw new Error("User not authenticated");

        const res = await axios.post(`${API_BASE}/api/send_delegation`, delegationData, {
            headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        });
        return res.data;
    };

    const getDelegationDataFromAPI = async (smart_account) => {
        const authToken = token;
        if (!authToken) throw new Error("User not authenticated");

        const res = await axios.post(`${API_BASE}/api/delegations`, { smart_account }, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        return res.data;
    };

    const cancelDelegationTask = async (_id) => {
        const authToken = token;
        if (!authToken) throw new Error("User not authenticated");

        const res = await axios.post(`${API_BASE}/api/cancel_delegation`, { _id }, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        return res.data;
    };

    // --- HEALTH ---
    const getHealth = async () => {
        const res = await axios.get(`${API_BASE}/api/health`);
        return res.data;
    };

    return {
        token,
        tokenData,
        login,
        logout,
        getNonce,
        getUserData,
        getHealth,
        postDelegationData,
        getDelegationDataFromAPI,
        cancelDelegationTask,
    };
}
