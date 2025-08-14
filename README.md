# Spearfish AI

**AI-Powered Y Combinator Company Discovery & Investment Analysis Platform**

Spearfish AI is an intelligent platform that discovers, analyzes, and scores Y Combinator companies based on investment potential using our proprietary Spearfish scoring algorithm (0-10 scale). Built for investors, analysts, and anyone interested in tracking the most promising startups from Y Combinator's portfolio.

## 🚀 Features

- **Proprietary Scoring Algorithm**: 0-10 scale scoring based on 9+ weighted investment criteria
- **Real-time GitHub Integration**: Automatic repository discovery and metrics tracking
- **AI-Powered Research**: Deep market analysis using advanced AI research capabilities
- **Company Discovery Dashboard**: Advanced filtering and search across Y Combinator companies
- **Historical Score Tracking**: Monitor company performance over time with algorithm versioning
- **Secure Multi-tenant Platform**: JWT-based authentication with row-level security

## 🛠 Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with Edge Runtime support
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Clerk with JWT integration to Supabase
- **AI Services**: OpenAI, Perplexity for research and classification
- **External APIs**: GitHub API, Y Combinator data integration
- **Testing**: Jest with React Testing Library and jsdom
- **Deployment**: Vercel with automated cron jobs

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Clerk account for authentication
- OpenAI API key (for AI features)
- Perplexity API key (for research features)
- GitHub token (optional, for repository data)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spearfish-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in the required environment variables:
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
   OPENAI_API_KEY="your_openai_api_key"
   PERPLEXITY_API_KEY="your_perplexity_key"

   # GitHub API (Optional)
   GITHUB_TOKEN="your_github_token"
   ```

4. **Set up the database**
   ```bash
   # Install Supabase CLI if not already installed
   npm install -g @supabase/cli
   
   # Apply database migrations
   supabase db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🚦 Available Scripts

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

# Database migrations (via Supabase CLI)
supabase db push     # Apply migrations to remote database
supabase db reset    # Reset local database
```

## 📁 Project Structure

```
spearfish-ai/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── companies/         # Company pages
│   │   └── dashboard/         # Main discovery interface
│   ├── components/            # React components
│   │   ├── auth/              # Authentication guards
│   │   ├── company/           # Company-specific components
│   │   ├── dashboard/         # Dashboard components
│   │   └── ui/                # Reusable UI components
│   └── lib/                   # Service layer & utilities
│       ├── services/          # Core business logic
│       ├── supabase-client.ts # Database connections
│       └── types/             # TypeScript type definitions
├── supabase/
│   └── migrations/            # Database schema migrations
├── scripts/                   # Utility scripts
└── __tests__/                # Test configuration
```

## 🔍 Core Features

### Spearfish Scoring Algorithm
- **Multi-factor Analysis**: Evaluates companies across 9+ investment criteria
- **Weighted Scoring**: Each factor contributes to a final 0-10 score
- **Historical Tracking**: Monitor score changes over time with algorithm versioning
- **Batch Processing**: Efficient recalculation for large datasets

### GitHub Integration
- **Automatic Repository Discovery**: Finds GitHub repos through company analysis
- **Real-time Metrics Tracking**: Stars, forks, and growth rate monitoring
- **Rate Limiting Handling**: Intelligent retry logic for GitHub API constraints
- **Historical Data**: Track repository performance over time

### AI Research System
- **Market Analysis**: AI-powered research using Perplexity's latest models
- **Session Tracking**: Maintain research history and progress
- **Template-based Queries**: Consistent, high-quality research outputs
- **Progress Indicators**: Real-time feedback for long-running operations

## 🔐 Authentication & Security

- **Clerk Authentication**: Social login with Google, GitHub, and more
- **JWT Integration**: Secure token passing between Clerk and Supabase
- **Row Level Security (RLS)**: Multi-tenant data isolation at the database level
- **API Key Management**: Environment-based configuration for external services

## 🧪 Testing

The project uses Jest with React Testing Library:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:ci
```

Tests are organized as:
- **Unit Tests**: Service layer functions (`src/lib/__tests__/`)
- **Component Tests**: React components with user interactions
- **Integration Tests**: API routes and database operations

## 🚀 Deployment

The application is designed for deployment on Vercel with the following setup:

1. **Connect to Vercel**: Link your repository to Vercel
2. **Environment Variables**: Configure all required environment variables in Vercel dashboard
3. **Database**: Ensure Supabase database is properly configured and migrations applied
4. **Cron Jobs**: Set up Vercel cron functions for automated data synchronization

## 📊 Database Schema

### Core Tables
- **companies**: Y Combinator companies with Spearfish scores
- **user_profiles**: User data synced with Clerk authentication  
- **github_repositories**: GitHub repository data and metrics
- **github_repository_metrics**: Historical growth tracking
- **score_history**: Historical scoring with algorithm versioning
- **research_sessions**: AI research session tracking
- **founders**: Company team member information

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:
- Check the [documentation](./CLAUDE.md) for detailed development guidelines
- Review existing issues in the repository
- Contact the development team for access and setup assistance

## 🔄 API Integration

### External Services
- **Y Combinator API**: Company and batch data synchronization
- **GitHub API**: Repository discovery and metrics collection
- **OpenAI**: AI classification and analysis
- **Perplexity**: Advanced research capabilities

### Rate Limiting
- GitHub API: Intelligent retry and backoff strategies
- Research APIs: Request queuing and progress tracking
- Database: Optimized queries and connection pooling

---

**Built with ❤️ for the startup investment community**
