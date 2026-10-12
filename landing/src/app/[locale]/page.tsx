import {ArrowNav} from "@/components/site/ArrowNav";
import {Footer} from "@/components/site/Footer";
import {Header} from "@/components/site/Header";
import {Hero} from "@/components/site/Hero";
import {Install} from "@/components/site/Install";
import {Library} from "@/components/site/Library";
import {Tour} from "@/components/site/Tour";

export default function Home() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Tour />
        <Library />
        <Install />
      </main>
      <Footer />
      <ArrowNav />
    </>
  );
}
