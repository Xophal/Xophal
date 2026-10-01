import { APP_NAME } from "@/constants";

type BrandWordmarkProps = {
  variant?: "full" | "compact";
  inverse?: boolean;
  className?: string;
};

export default function BrandWordmark({
  variant = "full",
  inverse = false,
  className = "",
}: BrandWordmarkProps) {
  return (
    <span className={`inline-flex flex-col items-start gap-1 leading-none ${className}`}>
      <span className={`font-display font-extrabold ${variant === "full" ? "text-xl" : "text-sm"} ${inverse ? "text-white" : "text-xophol-blue"}`}>
        <span>{APP_NAME.slice(0, 1)}</span>
        <span className="text-xophol-orange">{APP_NAME.slice(1, 2)}</span>
        <span>{APP_NAME.slice(2)}</span>
      </span>
      {variant === "full" ? (
        <span className={`text-[0.5rem] font-semibold uppercase ${inverse ? "text-white/75" : "text-xophol-blue/75"}`}>
          Prepare today, achieve tomorrow
        </span>
      ) : null}
    </span>
  );
}