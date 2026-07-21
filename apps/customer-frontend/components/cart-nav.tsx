"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customerRequest } from "@/lib/customer-api";

export function CartNav() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    customerRequest<any>("/cart").then((cart) => setCount(cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0))).catch(() => setCount(0));
  }, []);

  return <Link href="/cart" className="cart-nav">Cart{count > 0 ? <span className="cart-count">{count}</span> : null}</Link>;
}
