import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from "@nestjs/common";
import { getPrismaClient } from "@readycheck/db";
import { RULE_CATALOG, RULE_PACKS, type CatalogRule, type RulePack } from "@readycheck/rules";
import { ApiKeyGuard } from "./api-key.guard";
import { CurrentTenant, requireRole, type Tenant } from "./tenancy/tenant";

const prisma = getPrismaClient();

export interface RulesDto {
  packs: RulePack[];
  rules: (CatalogRule & { enabled: boolean })[];
}

@Controller("rules")
@UseGuards(ApiKeyGuard)
export class RulesController {
  @Get()
  async list(@CurrentTenant() tenant: Tenant): Promise<RulesDto> {
    const org = await prisma.organization.findUnique({ where: { id: tenant.orgId }, select: { disabledRules: true } });
    const off = new Set(org?.disabledRules ?? []);
    return { packs: RULE_PACKS, rules: RULE_CATALOG.map((r) => ({ ...r, enabled: !off.has(r.id) })) };
  }

  /** Switches a rule on or off for the org's future scans. */
  @Put(":id")
  async set(@CurrentTenant() tenant: Tenant, @Param("id") id: string, @Body() body: { enabled?: unknown }) {
    requireRole(tenant, "admin");
    if (!RULE_CATALOG.some((r) => r.id === id)) throw new NotFoundException(`No rule ${id}.`);
    if (typeof body.enabled !== "boolean") throw new BadRequestException("enabled must be true or false.");
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: tenant.orgId }, select: { disabledRules: true } });
    const off = new Set(org.disabledRules);
    if (body.enabled) off.delete(id);
    else off.add(id);
    await prisma.organization.update({ where: { id: tenant.orgId }, data: { disabledRules: [...off] } });
    return { id, enabled: body.enabled };
  }
}
