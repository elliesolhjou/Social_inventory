"use client";

import { useState, useEffect } from "react";

export default function TimeGreeting() {
  const [greeting, setGreeting] = useState("afternoon");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("morning");
    else if (h < 17) setGreeting("afternoon");
    else setGreeting("evening");
  }, []);

  return <>Good {greeting} 👋</>;
}
