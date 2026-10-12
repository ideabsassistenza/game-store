import Image from "next/image";

// Where the generated room's TV panel sits in public/scene/living-room.webp (1536 × 1024), in percent.
const SCREEN = {left: "21.875%", top: "18.9%", width: "56.2%", height: "46.7%"};
// The room's wall is near black, not black: every edge dissolves into the page, over --edge at the sides.
const fade = (right: string) => ({
  maskImage: `linear-gradient(to right, transparent, #000 var(--edge), #000 ${right}, transparent), linear-gradient(to bottom, transparent, #000 22%, #000 76%, transparent)`,
  maskComposite: "intersect",
});

type Crop = {left: number; top: number; width: number; height: number};

/** The room cropped to `crop` (percent of the photo): the window keeps the crop's aspect, the photo fills it. */
function cropped({left, top, width, height}: Crop) {
  return {
    window: {aspectRatio: `${width * 1536} / ${height * 1024}`},
    photo: {position: "absolute" as const, width: `${10000 / width}%`, left: `${-left * 100 / width}%`, top: `${-top * 100 / height}%`},
  };
}

/**
 * A 1920 × 1080 capture of the app on the TV in a dark room, the console standing beside it. `frame` sizes
 * and offsets the room inside the faded window, to crop in closer on the TV; the right edge
 * dissolves from `fadeRight`. `crop` instead cuts the window to that part of the photo, uncapped. Phones
 * crop in until the TV nearly fills the width, under a narrower side fade.
 */
export function TvScene({shot, alt, priority = false, sizes = "(min-width: 1408px) 792px, (min-width: 768px) 56vw, 85vw",
  frame = "-ml-[25%] w-[150%] md:ml-0 md:w-full", fadeRight = "calc(100% - var(--edge))", crop}:
  {shot: string; alt: string; priority?: boolean; sizes?: string; frame?: string; fadeRight?: string; crop?: Crop}) {
  const cut = crop && cropped(crop);
  return (
    <div dir="ltr" className={`relative overflow-hidden [--edge:5%] md:[--edge:14%] ${cut ? "" : "mx-auto max-w-[88rem]"}`}
      style={{...fade(fadeRight), ...cut?.window}}>
      <div className={cut ? "" : `relative ${frame}`} style={cut?.photo}>
        <Image src="/scene/living-room.webp" alt="" aria-hidden width={1536} height={1024} quality={90} sizes="(min-width: 768px) 88rem, 150vw"
          className="h-auto w-full" priority={priority} />
        <div className="absolute overflow-hidden bg-canvas" style={SCREEN}>
          <Image src={shot} width={1920} height={1080} quality={90} sizes={sizes} alt={alt}
            className="h-full w-full object-cover" priority={priority} />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.06),transparent_38%)]" />
        </div>
      </div>
    </div>
  );
}
