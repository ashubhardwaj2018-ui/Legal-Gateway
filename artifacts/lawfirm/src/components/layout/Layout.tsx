import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans selection:bg-secondary/30 selection:text-primary">
      <Navbar />
      <main className="flex-1 w-full pt-[80px] lg:pt-[90px]">
        {children}
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
