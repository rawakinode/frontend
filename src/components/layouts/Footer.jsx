export function Footer() {
  return (
    <footer className="w-full mt-10 border-t border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="flex items-center justify-center gap-4 text-sm">
          {/* Swifter Logo & Name */}
          <div className="flex items-center gap-2">
            <img
              src="/swifter_white.svg"
              alt="Swifter Logo"
              className="w-5 h-5"
            />
            <span className="font-medium">Swifter</span>
          </div>

          {/* Separator */}
          <div className="text-muted-foreground">|</div>

          {/* Partner Logos */}
          <div className="flex items-center gap-3">
            <a href="https://www.monad.xyz" target="_blank" rel="noopener noreferrer">
              <img
                src="/monad.svg"
                alt="Monad"
                className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity"
              />
            </a>
            <span>•</span>
            <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">
              <img
                src="/metamask-white.svg"
                alt="Metamask"
                className="w-8 h-8 opacity-80 hover:opacity-100 transition-opacity"
              />
            </a>
            <span>•</span>
            <a href="https://monorail.xyz" target="_blank" rel="noopener noreferrer">
              <img
                src="/monorail.png"
                alt="Monorail"
                className="w-15 h-5 opacity-80 hover:opacity-100 transition-opacity"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}