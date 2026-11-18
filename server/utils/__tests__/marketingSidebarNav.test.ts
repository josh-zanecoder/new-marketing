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
    // Images, Beefree, builders, and Template approvals are gated by registry flags
    // (builders may reuse email-templates:read). Page tabs each need a distinct CRM code.
    const permissionBound = marketingSidebarNavItems.filter(
      (item) =>
        !item.requiresTenantImages &&
        !item.requiresTenantBeefree &&
        !item.requiresTenantGrapesBuilder &&
        !item.requiresTenantTemplateBuilder &&
        !item.requiresTenantTemplateApproval &&
        !item.requiresTemplateApprover &&
        !item.requiresLoRecipientLists,
    );
    const permissions = permissionBound.map((item) => item.requiredPermission);
    expect(permissions.every(Boolean)).toBe(true);
    expect(new Set(permissions).size).toBe(permissionBound.length);
    expect(permissions).toContain("marketing:flyers:read");
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
