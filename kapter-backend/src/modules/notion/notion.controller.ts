import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { ClerkSessionAuth } from "../clerk/clerk-auth.service";
import { CurrentUser } from "../clerk/current-user.decorator";
import { Public } from "../clerk/public.decorator";
import { CreateNotionAuthorizationDto } from "./dto/create-notion-authorization.dto";
import { SearchNotionPagesDto } from "./dto/search-notion-pages.dto";
import { NotionService } from "./notion.service";

@ApiTags("notion")
@Controller("notion")
export class NotionController {
  constructor(private readonly notionService: NotionService) {}

  @Get("connection")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Return Notion OAuth connection status for the authenticated user",
  })
  async getConnectionStatus(@CurrentUser() currentUser: ClerkSessionAuth) {
    return {
      notion: await this.notionService.getConnectionStatus(currentUser.userId),
    };
  }

  @Post("connect")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Create a Notion OAuth authorization URL for the authenticated user",
  })
  async createAuthorizationUrl(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Body() body: CreateNotionAuthorizationDto,
  ) {
    return {
      authUrl: await this.notionService.buildAuthorizationUrl(
        currentUser.userId,
        body.returnToPath,
      ),
    };
  }

  @Get("pages/search")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Search shared Notion pages for the authenticated user's connection",
  })
  async searchPages(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Query() query: SearchNotionPagesDto,
  ) {
    return {
      pages: await this.notionService.searchPages(
        currentUser.userId,
        query.query,
      ),
    };
  }

  @Get("callback")
  @Public()
  @ApiOperation({
    summary:
      "Complete the Notion OAuth callback and redirect back to the web app",
  })
  async handleCallback(
    @Query("code") code: string | undefined,
    @Query("error") error: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.notionService.handleOAuthCallback({
      code,
      error,
      state,
    });

    return response.redirect(redirectUrl);
  }
}
