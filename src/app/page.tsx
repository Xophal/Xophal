import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import MarketingHomePage from "./(marketing)/page";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <MarketingHomePage />
      <Footer />
    </div>
  );
}
