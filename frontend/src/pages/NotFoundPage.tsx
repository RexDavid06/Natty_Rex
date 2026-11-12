import { Link } from "react-router-dom";
import { Logo } from "../components/layout/Logo";
import { Button } from "../components/ui";

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="absolute inset-0 grid-faint opacity-50" />
      <div className="relative">
        <Logo />
        <p className="mt-10 font-display text-7xl font-bold text-lime-400">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-white/40">This page does not exist or has moved.</p>
        <Link to="/">
          <Button className="mt-6">Return home</Button>
        </Link>
      </div>
    </div>
  );
}
