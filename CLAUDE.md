# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Spearfish AI** is an AI-powered Y Combinator company discovery and analysis platform that scores companies based on investment potential using the proprietary Spearfish scoring algorithm (0-10 scale).

### Technology Stack
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript, Tailwind CSS
- **Authentication**: Clerk with JWT integration to Supabase
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **External APIs**: GitHub API, OpenAI, Perplexity (for research)
- **Testing**: Jest with React Testing Library and jsdom
- **Deployment**: Vercel with cron jobs for data synchronization

## Essential Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint checks

# Testing
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:ci      # Run tests with coverage for CI

# Database migrations (run via Supabase CLI)
supabase db push     # Apply migrations to remote database
supabase db reset    # Reset local database
```

## Architecture Overview

### Service Layer Architecture (`src/lib/`)
- **Scoring System**: `spearfish-scoring-service.ts` - Core 0-10 company scoring algorithm
- **Database Services**: 
  - `spearfish-database-service.ts` - Company data operations
  - `supabase-client.ts`, `supabase-server.ts` - Database connections
- **External APIs**:
  - `github-service.ts`, `github-sync-service.ts` - GitHub API integration
  - `company-research-service.ts`, `perplexity-research-service.ts` - AI research
  - `yc-api.ts`, `yc-database.ts` - Y Combinator data integration
- **AI Classification**: `ai-classification-service.ts`, `integrated-ai-service.ts`

### Component Organization (`src/components/`)
- **Authentication**: `auth/` - Clerk auth guards and protected routes
- **Company Profile**: `company/` - Company pages with tabbed navigation
- **Dashboard**: `dashboard/` - Main discovery interface with filters
- **UI Components**: `ui/` - Reusable components (Breadcrumb, SocialShare)

### API Routes (`src/app/api/`)
- **Companies**: `/api/companies/` - Company CRUD operations
- **GitHub Integration**: `/api/github/` - Repository sync and metrics
- **Research System**: `/api/companies/[id]/research/` - AI-powered research
- **Scoring**: `/api/scoring/` - Score calculations and history
- **Cron Jobs**: `/api/cron/` - Automated data sync tasks

## Database Schema

### Core Tables
- **companies** - Y Combinator companies with Spearfish scores
- **user_profiles** - User data synced with Clerk authentication
- **github_repositories** - GitHub repo data and metrics tracking
- **github_repository_metrics** - Historical star/fork growth data
- **score_history** - Historical scoring with algorithm versioning
- **research_sessions** - AI research session tracking
- **founders** - Company team member data

### Key Features
- **Row Level Security (RLS)** enabled for multi-tenant data access
- **Real-time metrics** tracking for GitHub repositories
- **Batch processing** for large-scale data operations
- **JWT integration** between Clerk and Supabase

## Environment Configuration

Required environment variables (see `.env.example`):

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your_clerk_publishable_key"
CLERK_SECRET_KEY="your_clerk_secret_key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# AI Services
OPENAI_API_KEY="your_openai_api_key"        # For AI classification
PERPLEXITY_API_KEY="your_perplexity_key"    # For research features

# GitHub API (Optional)
GITHUB_TOKEN="your_github_token"            # For repository data
```

## Key Development Patterns

### Authentication Flow
1. **Clerk** handles user authentication with social providers
2. **JWT templates** pass user context to Supabase
3. **RLS policies** enforce data access based on user context
4. **Auth guards** protect sensitive routes and components

### Scoring Algorithm
- **Weighted criteria** across 9 factors (batch, age, funding stage, etc.)
- **0-10 scale** with detailed breakdowns for transparency
- **Historical tracking** with algorithm versioning
- **Batch recalculation** via cron jobs for data consistency

### GitHub Integration
- **Repository discovery** through company analysis
- **Metrics tracking** (stars, forks, growth rates)
- **Automated sync** via cron jobs
- **Rate limiting** handling for GitHub API

### Research System
- **AI-powered research** using Perplexity for market analysis
- **Session tracking** for research history
- **Progress indicators** for long-running operations
- **Template-based queries** for consistent research quality

## MCP Server Configuration

Current MCP servers in `.mcp.json`:
- **context7** - Documentation and code examples lookup
- **puppeteer** - Browser automation for testing

Use Context7 for documentation lookup before implementing features:
```javascript
// Always resolve library IDs first
mcp__context7__resolve-library-id("next.js")
// Then get specific documentation
mcp__context7__get-library-docs("/vercel/next.js", topic: "app-router")
```

## Testing Strategy

### Jest Configuration
- **jsdom environment** for React component testing
- **Module path mapping** with `@/` alias to `src/`
- **Coverage collection** from all source files except app structure
- **Setup file** for React Testing Library configuration

### Test Organization
- **Unit tests**: Service layer functions (scoring, database operations)
- **Component tests**: React components with user interaction
- **Integration tests**: API routes and database operations

Example test locations:
- `src/lib/__tests__/` - Service layer unit tests
- Component tests alongside components (when needed)

## Production Considerations

### Performance Optimization
- **Real-time scoring** with background recalculation
- **GitHub API rate limiting** with intelligent retry logic
- **Database indexing** for company search and filtering
- **Caching strategies** for frequently accessed data

### Security Features
- **Row Level Security** for multi-tenant data isolation
- **JWT validation** between Clerk and Supabase
- **API key management** with environment-based configuration
- **CORS handling** for external API integrations

### Monitoring & Observability
- **Error boundaries** for graceful failure handling
- **API response monitoring** for external service health
- **Database query performance** tracking
- **User session analytics** through research tracking

## Development Workflow

### Typical Feature Development
1. **Check existing patterns** in similar components/services
2. **Query documentation** via Context7 MCP for relevant technologies
3. **Follow service layer architecture** for business logic
4. **Implement with TypeScript** strict typing and Zod validation
5. **Add tests** for new functionality
6. **Update database schema** if needed via migrations

### Database Changes
1. **Create migration file** in `supabase/migrations/`
2. **Test locally** with `supabase db reset`
3. **Apply to production** via `supabase db push`
4. **Update service layer** to use new schema

### Component Development
1. **Follow existing patterns** in `components/` directories
2. **Use Tailwind CSS** for consistent styling
3. **Implement TypeScript interfaces** for props
4. **Add proper error handling** with fallback states

## Important Notes

- **Never commit API keys** or sensitive configuration
- **Always use TypeScript** strict mode for new code
- **Follow RLS patterns** for database access
- **Use Zod schemas** for API route validation
- **Implement proper error boundaries** for user-facing components
- **Test GitHub API integrations** carefully due to rate limits
- **Use path aliases** (`@/` → `src/`) for cleaner imports

## Task Management Integration

This project uses Task Master AI for development planning. The current CLAUDE.md focuses on the Spearfish AI application itself, but Task Master commands remain available for project management:

- `task-master list` - View current development tasks
- `task-master next` - Get next task to work on
- `task-master show <id>` - View specific task details

Task Master integration is configured via `.taskmaster/` directory and MCP servers.