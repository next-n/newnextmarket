import Link from "next/link";
import { AccountNav } from "@/components/account-nav";
import { AppMenu } from "@/components/app-menu";
import { CartNav } from "@/components/cart-nav";

export function SiteHeader() { return <header className="site-header"><div className="container header-inner"><Link href="/" className="brand">Storefront</Link><nav className="nav"><AppMenu /><CartNav /><AccountNav /></nav></div></header>; }
