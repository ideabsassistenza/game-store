import {useFormatter, useTranslations} from "next-intl";
import Image from "next/image";
import GlareHover from "@/components/GlareHover";
import {ShineBorder} from "@/components/ui/shine-border";
import {type Platform, PlatformTag} from "./PlatformTag";

/**
 * A cover as the app's card behaves under focus (native/ui/GameCard.jsx): it lifts, a light runs around
 * its edge and a shine crosses it, on pointer and on keyboard focus alike.
 */
export function CoverCard({title, cover, platforms, genre}: {title: string; cover: string; platforms: Platform[]; genre: string}) {
  const t = useTranslations("Library");
  const format = useFormatter();
  return (
    <div tabIndex={0} aria-label={t("card", {title, platforms: format.list(platforms.map(p => p.toUpperCase()))})} className="group rounded-lg outline-none">
      <div className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 motion-reduce:transition-none">
        <GlareHover width="100%" height="auto" background="transparent" borderRadius="8px" borderColor="transparent"
          glareColor="#ffffff" glareOpacity={0.28} glareAngle={-30} glareSize={260} transitionDuration={750} className="cursor-default">
          <Image src={cover} alt="" width={180} height={240} unoptimized loading="lazy"
            className="aspect-[3/4] h-auto w-full rounded-lg bg-surface-2 object-cover" />
          <PlatformTag platforms={platforms} className="absolute start-2 bottom-2" />
          <ShineBorder borderWidth={1.5} duration={6} shineColor={["#ffffff"]}
            className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
        </GlareHover>
      </div>
      <p className="mt-3 text-[13px] text-subtle">{genre}</p>
      <p className="mt-0.5 line-clamp-2 text-[15px] leading-5 font-medium text-fg/85 transition-colors group-hover:text-fg group-focus-visible:text-fg">{title}</p>
    </div>
  );
}
