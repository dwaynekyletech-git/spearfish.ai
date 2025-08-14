# Spearfish AI

**Strategic Job Preparation Platform for AI Company Career Advancement**

Spearfish AI is a strategic job preparation platform that enables targeted career advancement through the "spearfishing" methodology. Instead of competing with hundreds of applicants through traditional job boards, users create their own opportunities by demonstrating immediate value to carefully selected AI companies.

## 🚀 Features

- **Spearfishing Methodology**: Strategic targeting of AI companies instead of mass applications
- **Company Research & Analysis**: Deep insights into target AI companies and their needs
- **Value Demonstration Tools**: Create targeted project ideas and proposals that show immediate impact
- **AI-Powered Research**: Comprehensive company analysis using advanced AI research capabilities
- **Email Generation**: Craft personalized outreach emails that demonstrate understanding and value
- **Project Artifact Creation**: Generate compelling project proposals and proof-of-concepts
- **Secure Multi-tenant Platform**: JWT-based authentication with row-level security

## 🛠 Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with Edge Runtime support
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Clerk with JWT integration to Supabase
- **AI Services**: OpenAI, Perplexity for research and classification
- **External APIs**: GitHub API, company data integration
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
│   │   ├── companies/         # Company analysis pages
│   │   └── dashboard/         # Main job preparation interface
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

### Spearfishing Methodology
- **Strategic Company Targeting**: Focus on quality opportunities over quantity applications
- **Value-First Approach**: Demonstrate immediate impact potential before applying
- **Personalized Outreach**: Custom proposals tailored to each company's specific needs
- **Proactive Opportunity Creation**: Generate your own opportunities instead of waiting for job postings

### AI-Powered Company Research
- **Deep Company Analysis**: Comprehensive research into target AI companies using advanced AI models
- **Market Positioning**: Understand company challenges, goals, and technology stack
- **Competitive Landscape**: Analyze company positioning within the AI industry
- **Session Tracking**: Maintain research history and insights for each target company

### Project & Email Generation
- **Targeted Project Ideas**: AI-generated project proposals that address specific company needs
- **Proof-of-Concept Creation**: Develop compelling demonstrations of your value proposition
- **Personalized Email Outreach**: Craft professional emails that showcase understanding and immediate value
- **Artifact Management**: Organize and track all generated materials for each opportunity

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
- **companies**: Target AI companies and their analysis data
- **user_profiles**: User data synced with Clerk authentication  
- **research_sessions**: AI research session tracking and insights
- **email_generations**: Generated outreach emails and templates
- **project_artifacts**: Created project proposals and proof-of-concepts
- **user_company_interactions**: Track user engagement with target companies
- **company_analysis**: Detailed company research and market positioning data

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
- **Company Data APIs**: AI company information and analysis
- **GitHub API**: Repository discovery and technology stack analysis
- **OpenAI**: AI-powered research and content generation
- **Perplexity**: Advanced company research and market analysis

### Rate Limiting
- Research APIs: Request queuing and progress tracking for AI-powered analysis
- Company Data APIs: Intelligent retry and backoff strategies
- Database: Optimized queries and connection pooling

---

**Built with ❤️ for strategic career advancement in AI**
