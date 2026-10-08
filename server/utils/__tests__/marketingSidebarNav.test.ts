import { describe, expect, it } from "vitest";
import {
  filterMarketingSidebarNavItems,
  marketingSidebarNavItems,
  type MarketingSidebarNavItem,
} from "../../../app/constants/marketingSidebarNav";

const items: MarketingSidebarNavItem[] = [
  { to: "/open", label: "Open", iconPath: "open" },
  {
    to: "/restricted",
    label: "Restricted",
    iconPath: "restricted",
    requiredPermission: "marketing:restricted:read",
  },
];

describe("filterMarketingSidebarNavItems", () => {
  it("maps every Marketing sidebar page to a distinct permission", () => {
    const permissions = marketingSidebarNavItems.map(
      (item) => item.requiredPermission,
    );
    expect(permissions.every(Boolean)).toBe(true);
    expect(new Set(permissions).size).toBe(marketingSidebarNavItems.length);
  });

  it("keeps existing navigation for sessions without a CRM permission snapshot", () => {
    expect(filterMarketingSidebarNavItems(items, undefined)).toEqual(items);
  });

  it("hides permission-bound items when the permission is missing", () => {
    expect(filterMarketingSidebarNavItems(items, [])).toEqual([items[0]]);
  });

  it("does not treat the Marketing launch permission as a page permission", () => {
    expect(filterMarketingSidebarNavItems(items, ["marketing:read"])).toEqual([
      items[0],
    ]);
  });

  it("shows permission-bound items when the permission is granted", () => {
    expect(
      filterMarketingSidebarNavItems(items, ["marketing:restricted:read"]),
    ).toEqual(items);
  });
});
