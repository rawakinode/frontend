import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Plus, AlertCircle, Check, ChevronDown, ExternalLink } from "lucide-react";

function TokenSelect({ selected, onChange, tokenList, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundToken, setFoundToken] = useState(null);
  const [customTokens, setCustomTokens] = useState([]);

  // Load custom tokens from localStorage on mount
  useEffect(() => {
    const storedTokens = localStorage.getItem('customTokens');
    if (storedTokens) {
      setCustomTokens(JSON.parse(storedTokens));
    }
  }, []);

  // Save custom tokens to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('customTokens', JSON.stringify(customTokens));
  }, [customTokens]);

  const allTokens = [...tokenList, ...customTokens];

  const filteredTokens = allTokens.filter(token =>
    token?.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    token?.name?.toLowerCase().includes(search.toLowerCase()) ||
    token?.address?.toLowerCase().includes(search.toLowerCase())
  );

  const isContractAddress = search.startsWith('0x') && search.length > 10;

  // Mock function untuk fetch token by address
  const fetchTokenByAddress = async (address) => {
    setIsSearching(true);
    // Simulasi delay network
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock data - dalam real app, ini akan panggil blockchain RPC atau API
    const mockTokens = {
      "0x1aba0b": { 
        symbol: "MON", 
        name: "Monad", 
        decimals: 18, 
        logo: "https://placehold.co/32x32?text=M",
        address: "0x1aba0b...",
        verified: true
      },
      "0x2bcd1e": { 
        symbol: "USDC", 
        name: "USD Coin", 
        decimals: 6, 
        logo: "https://placehold.co/32x32?text=U",
        address: "0x2bcd1e...",
        verified: true
      }
    };
    
    const normalizedAddress = address.toLowerCase().slice(0, 6);
    setIsSearching(false);
    return mockTokens[normalizedAddress] || null;
  };

  const handleSearch = async (value) => {
    setSearch(value);
    
    if (isContractAddress && value.length >= 6) {
      const token = await fetchTokenByAddress(value);
      setFoundToken(token);
    } else {
      setFoundToken(null);
    }
  };

  const handleImportToken = (token) => {
    // Check if token already exists
    if (!customTokens.find(t => t.address === token.address) && !tokenList.find(t => t.address === token.address)) {
      const newCustomTokens = [...customTokens, { ...token, isCustom: true }];
      setCustomTokens(newCustomTokens);
      
      // Auto-select the imported token
      onChange(token);
      setOpen(false);
      setSearch("");
    }
  };

  const handleTokenSelect = (token) => {
    onChange(token);
    setOpen(false);
    setSearch("");
    setFoundToken(null);
  };

  function TokenItem({ token, onSelect, isSelected }) {
    return (
      <button
        onClick={() => onSelect(token)}
        className="flex items-center justify-between w-full p-3 hover:bg-white/5 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-xs font-medium">{token?.symbol?.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{token?.symbol}</span>
              {token?.verified && (
                <span className="text-xs bg-blue-500 text-white px-1 rounded">✓</span>
              )}
              {token?.isCustom && (
                <span className="text-xs bg-gray-500 text-white px-1 rounded">Custom</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">{token?.name}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isSelected && (
            <Check className="w-4 h-4 text-green-400" />
          )}
        </div>
      </button>
    );
  }

  function ImportTokenRow({ token, onImport }) {
    const [isLoading, setIsLoading] = useState(false);

    const handleImport = async () => {
      setIsLoading(true);
      await onImport(token);
      setIsLoading(false);
    };

    return (
      <div className="p-3 border border-yellow-500/30 bg-yellow-500/10 rounded-lg m-3">
        <div className="flex items-start gap-3 mb-2">
          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-yellow-300">Trade at your own risk!</div>
            <div className="text-sm text-yellow-400">
              This token doesn't appear on the active token list(s). Anyone can create a token.
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between p-2 bg-white/5 rounded">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-xs font-medium">{token?.symbol?.charAt(0)}</span>
            </div>
            <div>
              <div className="font-medium">{token?.symbol}</div>
              <div className="text-sm text-muted-foreground">{token?.name}</div>
            </div>
          </div>
          <Button 
            onClick={handleImport} 
            disabled={isLoading}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
            size="sm"
          >
            {isLoading ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {selected ? (
            <>
              <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center">
                <span className="text-xs font-medium">{selected?.symbol?.charAt(0)}</span>
              </div>
              <span className="font-semibold">{selected?.symbol}</span>
            </>
          ) : (
            <span className="font-semibold">Select token</span>
          )}
          <ChevronDown className="w-4 h-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md p-0 gap-0 bg-black/95 backdrop-blur-md border border-white/10 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold">Select a token</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setOpen(false)}
            className="rounded-full h-8 w-8 text-white hover:bg-white/10"
          >
            ×
          </Button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search name or paste address"
              className="pl-10 pr-4 py-2 bg-white/5 border-0 text-white placeholder:text-gray-400"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Token List */}
        <div className="max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
            </div>
          ) : foundToken ? (
            <ImportTokenRow 
              token={foundToken} 
              onImport={handleImportToken}
            />
          ) : isContractAddress && search.length > 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No token found at this address</p>
            </div>
          ) : filteredTokens.length > 0 ? (
            <div className="divide-y divide-white/10">
              {filteredTokens.map((token) => (
                <TokenItem
                  key={token.address}
                  token={token}
                  onSelect={handleTokenSelect}
                  isSelected={selected?.address === token.address}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tokens found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <Button 
            variant="outline" 
            className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10"
            onClick={() => {
              // Manage token lists functionality bisa ditambahkan later
              console.log("Manage tokens");
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Manage Token Lists
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}