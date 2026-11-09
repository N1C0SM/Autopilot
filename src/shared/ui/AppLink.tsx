import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { appHref } from "@/shared/lib/appHost";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

/** Enlace a la app: en autopilotplan.com salta a app.autopilotplan.com. */
export const AppLink = forwardRef<HTMLAnchorElement, Props>(({ to, ...rest }, ref) => {
  const href = typeof window === "undefined" ? to : appHref(to);
  if (href.startsWith("http")) return <a ref={ref} href={href} {...rest} />;
  return <Link ref={ref} to={to} {...rest} />;
});
AppLink.displayName = "AppLink";
