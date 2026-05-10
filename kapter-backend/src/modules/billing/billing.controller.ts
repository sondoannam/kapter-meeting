import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { ClerkSessionAuth } from "../clerk/clerk-auth.service";
import { CurrentUser } from "../clerk/current-user.decorator";
import { Public } from "../clerk/public.decorator";
import { BILLING_PLANS } from "./billing-plans";
import { BillingService } from "./billing.service";

@ApiTags("billing")
@ApiBearerAuth()
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get("plans")
  @ApiOperation({
    summary: "Return public subscription plan definitions",
  })
  getPlans() {
    return {
      plans: BILLING_PLANS,
    };
  }

  @Get()
  @ApiOperation({
    summary: "Return pricing plans and the authenticated user's quota snapshot",
  })
  async getBillingStatus(@CurrentUser() currentUser: ClerkSessionAuth) {
    return this.billingService.getBillingStatus(currentUser.userId);
  }

  @Get("me")
  @ApiOperation({
    summary: "Return the authenticated user's quota snapshot",
  })
  async getQuotaStatus(@CurrentUser() currentUser: ClerkSessionAuth) {
    const billing = await this.billingService.getBillingStatus(
      currentUser.userId,
    );

    return {
      quota: billing.quota,
    };
  }
}
