/** Logo asset in /public */
export const APP_LOGO_SRC = "/VC%20Fund%20Research%20and%20Tool%20Building.svg";

const ASPECT = 1000 / 391;

type AppLogoProps = {
  /** Full wordmark vs circular mark (left crop) */
  variant?: "full" | "mark";
  height?: number;
  className?: string;
};

export function AppLogo({
  variant = "full",
  height = 32,
  className = "",
}: AppLogoProps) {
  if (variant === "mark") {
    const size = height;
    return (
      <span
        className={`relative inline-block overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={APP_LOGO_SRC}
          alt=""
          className="absolute left-0 top-0 h-full max-w-none"
          style={{
            width: Math.round(size * ASPECT),
            objectFit: "cover",
            objectPosition: "left center",
          }}
        />
      </span>
    );
  }

  const width = Math.round(height * ASPECT);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={APP_LOGO_SRC}
      alt="VC Fund Research and Tool Building"
      height={height}
      width={width}
      className={`shrink-0 ${className}`}
      style={{ height, width: "auto", maxWidth: width }}
    />
  );
}
