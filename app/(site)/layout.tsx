import { StatusBar } from "@/components/layout/StatusBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/ui/ScrollProgress";

/** Marketing chrome for the public site. The admin route sits outside this group. */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ScrollProgress />
      <StatusBar />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
