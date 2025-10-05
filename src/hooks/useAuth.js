import { useState, useEffect, useRef } from "react";
import { useAPI } from "./useAPI";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";

export function useAuth() {

    const { token, tokenData, login, getNonce, getUserData, logout } = useAPI();
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(false);

    const { disconnect, data } = useDisconnect();

    // Auto-authenticate saat wallet connect
    const previousAddressRef = useRef(null);
    useEffect(() => {

        console.log(token);
        console.log(isConnected);
        

        const authenticate = async () => {
            console.log('authenticating user ...');
            await authenticateUser();
        };

        if (isConnected && address) {
            const addressChanged = previousAddressRef.current && previousAddressRef.current !== address;

            if (token == null || addressChanged) {
                authenticate();
            }

            previousAddressRef.current = address;
        }
    }, [isConnected, address, token]);

    // Auto logout saat wallet disconnect
    useEffect(() => {
        if (!isConnected) handleLogout();
    }, [isConnected]);

    // Auto logout jika token expired (dari state API)
    useEffect(() => {
        if (!token) return;

        const stored = localStorage.getItem("jwt_token");
        if (!stored) return;

        const { expiresAt } = JSON.parse(stored);
        const now = Date.now();

        if (expiresAt <= now) {
            handleLogout();
        } else {
            const timeout = setTimeout(() => handleLogout(), expiresAt - now);
            return () => clearTimeout(timeout);
        }
    }, [token]);

    const handleLogout = () => {
        logout();
        disconnect();
        setUserData(null);
        console.log('Log out');

    };

    const authenticateUser = async () => {

        console.log(address);

        if (!address) return;

        try {
            setLoading(true);

            const { nonce, message } = await getNonce(address);
            const signature = await signMessageAsync({ message });
            const loginRes = await login({ address, signature, nonce });

            // Pakai token dari login response langsung
            const user = await getUserData(loginRes.token);
            setUserData(user);
        } catch (err) {
            console.error("Authentication failed:", err);
            handleLogout();
        } finally {
            setLoading(false);
        }
    };

    return { token, userData, loading, isConnected, authenticateUser, handleLogout };
}
