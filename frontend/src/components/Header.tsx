"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { GlobalCommandDialog } from "./command-dialog";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";

type BreadcrumbItemObject = { label: string; href: string; isPage: boolean };
type BreadcrumbItemType = BreadcrumbItemObject | "ellipsis";

function BreadcrumbLinks() {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  // Build cumulative path segments for correct hrefs
  const cumulativePaths = pathSegments.map(
    (_segment, idx) => "/" + pathSegments.slice(0, idx + 1).join("/")
  );

  // If the path is long enough for ellipsis, show only first, ellipsis, last two
  let items: BreadcrumbItemType[];
  if (pathSegments.length > 4) {
    items = [
      {
        label: pathSegments[0],
        href: cumulativePaths[0],
        isPage: false,
      },
      "ellipsis",
      {
        label: pathSegments[pathSegments.length - 2],
        href: cumulativePaths[pathSegments.length - 2],
        isPage: false,
      },
      {
        label: pathSegments[pathSegments.length - 1],
        href: cumulativePaths[pathSegments.length - 1],
        isPage: true,
      },
    ];
  } else {
    items = pathSegments.map(
      (segment, idx): BreadcrumbItemObject => ({
        label: segment,
        href: cumulativePaths[idx],
        isPage: idx === pathSegments.length - 1,
      })
    );
  }

  // Always prefix with Home
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathSegments.length > 0 && <BreadcrumbSeparator />}
        {items.map((item, idx) => {
          if (item === "ellipsis") {
            return (
              <React.Fragment key={`ellipsis-${idx}`}>
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </React.Fragment>
            );
          } else {
            return (
              <React.Fragment key={item.href}>
                <BreadcrumbItem>
                  {item.isPage ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {idx !== items.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          }
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function Header() {
  return (
    <header className="flex flex-col p-2 border-b border-brand-grey-3">
      <div className="flex flex-row items-center justify-between">
        <BreadcrumbLinks />
        <GlobalCommandDialog />
      </div>
    </header>
  );
}
