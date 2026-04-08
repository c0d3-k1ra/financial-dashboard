import { usePrivacy } from "@/lib/privacy-context";
import type { ReactNode } from "react";

interface SensitiveValueProps {
  children: ReactNode;
  className?: string;
  as?: "span" | "div";
}

export function SensitiveValue({ children, className = "", as: Tag = "span" }: SensitiveValueProps) {
  const { isHidden } = usePrivacy();

  return (
    <Tag
      className={`${isHidden ? "sensitive-blur" : "sensitive-visible"} ${className}`}
      aria-hidden={isHidden}
    >
      {children}
    </Tag>
  );
}
