import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { ClerkSessionAuth } from "../clerk/clerk-auth.service";
import { CurrentUser } from "../clerk/current-user.decorator";
import { NotionService } from "../notion/notion.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ConfigureProjectNotionDestinationDto } from "./dto/configure-project-notion-destination.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly notionService: NotionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Return dashboard project summaries for the authenticated user",
  })
  async getProjectsForUser(@CurrentUser() currentUser: ClerkSessionAuth) {
    return {
      projects: await this.projectsService.listProjects(currentUser.userId),
    };
  }

  @Post()
  @ApiOperation({
    summary: "Create a project for the authenticated user",
  })
  async createProjectForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Body() body: CreateProjectDto,
  ) {
    return {
      project: await this.projectsService.createProject(
        currentUser.userId,
        body,
      ),
    };
  }

  @Get(":projectId")
  @ApiOperation({
    summary: "Return one project detail payload for the authenticated user",
  })
  async getProjectDetailForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("projectId") projectId: string,
  ) {
    return {
      project: await this.projectsService.getProjectDetail(
        currentUser.userId,
        projectId,
      ),
    };
  }

  @Patch(":projectId")
  @ApiOperation({
    summary: "Update one project for the authenticated user",
  })
  async updateProjectForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("projectId") projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return {
      project: await this.projectsService.updateProject(
        currentUser.userId,
        projectId,
        body,
      ),
    };
  }

  @Delete(":projectId")
  @ApiOperation({
    summary: "Delete one empty project for the authenticated user",
  })
  async deleteProjectForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("projectId") projectId: string,
  ) {
    await this.projectsService.deleteProject(currentUser.userId, projectId);

    return {
      deletedProjectId: projectId,
    };
  }

  @Post(":projectId/notion-destination")
  @ApiOperation({
    summary:
      "Create or attach the authenticated user's Notion destination for one project",
  })
  async configureProjectNotionDestination(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("projectId") projectId: string,
    @Body() body: ConfigureProjectNotionDestinationDto,
  ) {
    await this.notionService.configureProjectDestination(
      currentUser.userId,
      projectId,
      body,
    );

    return {
      project: await this.projectsService.getProjectDetail(
        currentUser.userId,
        projectId,
      ),
    };
  }

  @Delete(":projectId/notion-destination")
  @ApiOperation({
    summary:
      "Detach the authenticated user's Notion destination metadata from one project without deleting remote Notion content",
  })
  async clearProjectNotionDestination(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("projectId") projectId: string,
  ) {
    await this.notionService.clearProjectDestination(
      currentUser.userId,
      projectId,
    );

    return {
      project: await this.projectsService.getProjectDetail(
        currentUser.userId,
        projectId,
      ),
    };
  }
}
