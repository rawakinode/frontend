import { useState } from 'react';
import { Routes, Route } from "react-router-dom";
import './App.css';
import { ThemeProvider } from './theme-provider';
import { Header } from './components/layouts/Header';
import { Footer } from './components/layouts/Footer';
import { Swap } from './pages/Swap';

import { TooltipProvider } from "@/components/ui/tooltip";
import Task from './pages/Task';
import SmartWallet from './pages/SmartWallet';
import SubscribeSwap from './pages/SubscribeSwap'; 
import BatchConvertSwap from './pages/BatchConvertSwap';

function App() {
  return (
    <TooltipProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="min-h-screen flex flex-col">
          <Header />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Swap />} />
              <Route path="/swap" element={<Swap />} />
              <Route path="/subscribeswap" element={<SubscribeSwap />} />
              <Route path="/convert" element={<BatchConvertSwap />} />
              <Route path="/task" element={<Task />} />
              <Route path="/smartwallet" element={<SmartWallet />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </ThemeProvider>
    </TooltipProvider>
  );
}

export default App;