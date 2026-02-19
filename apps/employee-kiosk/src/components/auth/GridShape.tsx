/**
 * Decorative grid SVG for auth pages — inline version of TailAdmin's GridShape.
 * Renders two rotated dot-grid patterns in opposite corners.
 */
export function GridShape() {
  const grid = (
    <svg
      width="250"
      height="250"
      viewBox="0 0 250 250"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[250px] xl:max-w-[450px]"
    >
      {/* Generate a 10×10 dot grid */}
      {Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 10 }, (_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={12.5 + col * 25}
            cy={12.5 + row * 25}
            r="1.5"
            fill="currentColor"
            opacity="0.3"
          />
        ))
      )}
    </svg>
  );

  return (
    <>
      <div className="absolute right-0 top-0 -z-1 text-white/20">{grid}</div>
      <div className="absolute bottom-0 left-0 -z-1 rotate-180 text-white/20">{grid}</div>
    </>
  );
}
