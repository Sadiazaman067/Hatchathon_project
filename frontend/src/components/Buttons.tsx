import type { ButtonHTMLAttributes } from "react";

const base =
  "cursor-pointer border border-ink px-5 py-2.5 font-sans text-[14px] font-medium transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-40";

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${base} bg-ink text-sheet enabled:hover:bg-muted ${props.className ?? ""}`} />;
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${base} bg-transparent text-ink enabled:hover:bg-hair-2 ${props.className ?? ""}`} />;
}
