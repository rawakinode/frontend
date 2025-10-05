import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadTestnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Automation Monad Swap',
  projectId: 'bac9ebf8476d7c5e9efc867c6dd7345c',
  chains: [monadTestnet],
  autoConnect: false,
});
