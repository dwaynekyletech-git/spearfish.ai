# Spearfish AI - Product Requirements Document

## Overview

Spearfish AI is a strategic job preparation platform that enables targeted career advancement through the "spearfishing" methodology. Instead of competing with hundreds of applicants through traditional job boards, users create their own opportunities by demonstrating immediate value to carefully selected AI companies.

The platform addresses the core problem identified in modern job searching: bulk applications have diminishing returns in an AI-saturated market where every resume is perfect and competition is fierce. By focusing exclusively on growth-stage AI companies (Series A, 18-24 months old) with strong technical signals, users can access the hidden job market where 70% of roles are never publicly posted.

Target users are AI professionals, engineers, and business professionals seeking roles at high-growth AI startups where equity upside is significant and individual impact is maximized. The platform transforms job searching from a numbers game into a strategic, value-driven process.

## Core Features

### 1. Smart Company Discovery Engine
**What it does:** Pulls all AI companies from Y Combinator and ranks them using a comprehensive spearfish scoring system based on the methodology criteria.

**Why it's important:** Every AI startup gets evaluated and scored, ensuring users see the highest-potential opportunities ranked by how well they match spearfishing criteria.

**How it works:** 
- Fetches all Y Combinator companies and filters for AI-related businesses
- Calculates spearfish score based on weighted criteria:
  - **Heavy weight**: W22, S22, W23 batches (target timing)
  - **High weight**: 18-24 months company age, Series A stage
  - **Medium weight**: GitHub star growth >1K/month, B2B focus, HuggingFace activity >100K downloads
  - **Low weight**: Conference speaking, "boring names", current hiring status
- Companies displayed ranked by total spearfish score (0-100)
- All qualified AI companies shown, with highest scorers featured prominently

### 2. Basic Search and Filtering
**What it does:** Enables simple text search and filtering to help users find specific companies or narrow down the curated list.

**Why it's important:** Allows users to quickly find companies in specific industries or with particular characteristics without complex discovery tools.

**How it works:**
- Basic text search across company names, descriptions, and industries
- Simple filtering by batch (W22, S22, W23), team size, and hiring status
- Tag-based filtering for quick industry categorization
- Results ranked by spearfish score

### 3. Deep Company Intelligence System
**What it does:** Generates comprehensive research reports on target companies including technical challenges, team dynamics, and opportunity signals.

**Why it's important:** Provides insider-level knowledge that enables users to understand company needs and position themselves as solutions rather than generic applicants.

**How it works:**
- Multi-source data aggregation (GitHub, LinkedIn, engineering blogs, conference talks)
- AI analysis of recent activities, hiring patterns, and technical discussions
- Identification of specific pain points and growth challenges
- Team composition analysis and key decision maker identification

### 4. Artifact Suggestion Engine
**What it does:** Recommends specific, high-impact projects users can create to demonstrate immediate value to target companies.

**Why it's important:** Bridges the gap between research and action, providing concrete ways to prove competence before interviewing.

**How it works:**
- Analyzes company technical challenges against user skill profile
- Suggests artifacts ranging from code contributions to business analyses
- Provides implementation guides, templates, and success metrics
- Tracks artifact completion and impact measurement

### 5. Cold Email Generation System
**What it does:** Creates personalized, value-first outreach emails based on company research and completed artifacts.

**Why it's important:** Transforms cold outreach from generic pitches to compelling value demonstrations that generate high response rates.

**How it works:**
- Personalizes messages using company intelligence and recipient research
- Incorporates artifact demonstrations and quantified impact
- Optimizes send timing and follow-up sequences
- A/B tests messaging effectiveness across campaigns

## User Experience

### User Personas

**Primary Persona: Strategic AI Professional**
- 3-7 years experience in AI/ML, software engineering, or technical product roles
- Currently employed but seeking career advancement and equity upside
- Values quality over quantity in job searching
- Willing to invest time for significantly better outcomes
- Frustrated with traditional application processes and low response rates

**Secondary Persona: Career Transition Candidate**
- Experienced professional transitioning into AI from adjacent fields
- Strong analytical or technical background but limited AI-specific experience
- Seeking to break into high-growth AI companies
- Needs guidance on how to position transferable skills effectively

**Tertiary Persona: New Grad/Junior Professional**
- Recent graduate or early career professional in AI/tech
- Limited professional network in AI industry
- Seeking mentorship and structured approach to career development
- Motivated to invest significant effort for long-term career benefits

### Key User Flows

**Flow 1: Company Discovery to Spearfish Launch**
1. User lands on curated company feed showing top spearfish targets
2. Uses semantic search to refine based on interests ("legal AI startups")
3. Reviews company cards with spearfish scores and growth indicators
4. Clicks on company of interest to view detailed profile
5. Reviews "Why Spearfish This Company" section with specific signals
6. Clicks "Spearfish This Company" to begin deep research

**Flow 2: Research to Artifact Creation**
1. System generates comprehensive company intelligence report
2. User reviews business intel, technical landscape, team insights, and opportunities
3. AI suggests 3-5 personalized artifact ideas based on company needs and user skills
4. User selects preferred artifact and receives implementation guide
5. User creates artifact with platform support and templates
6. System helps quantify and present artifact impact

**Flow 3: Artifact to Outreach**
1. User completes artifact and uploads/links to deliverable
2. System identifies optimal contacts (hiring managers, CTOs, team leads)
3. AI generates personalized cold email options incorporating artifact value
4. User customizes and sends email through platform
5. System tracks responses and suggests follow-up strategies
6. User manages ongoing relationship through CRM features

### UI/UX Considerations

**Design Principles:**
- **Confidence Building:** Every interface element reinforces the superiority of the spearfishing approach
- **Progressive Disclosure:** Complex research is presented in digestible, actionable chunks
- **Value Visualization:** Company intelligence and artifact impact are presented with clear, quantified metrics
- **Guided Experience:** Users never wonder "what's next" - clear CTAs guide the entire journey

**Key Interface Elements:**
- Company cards with visual spearfish scores and growth indicators
- Research dashboards with tabbed organization (Business, Technical, Team, Opportunities)
- Artifact creation wizards with step-by-step guidance and templates
- Email composer with real-time personalization suggestions
- Progress tracking throughout the spearfishing process

## Technical Architecture

### System Components

**Frontend Layer (React/Next.js)**
- Company discovery and search interface
- Research dashboard and data visualization
- Artifact creation tools and templates
- Email composition and campaign management
- User profile and progress tracking

**Backend Layer (Node.js/TypeScript)**
- RESTful API endpoints for all platform features
- Business logic and data processing
- External API orchestration (AI services, data sources)
- Background job processing for data updates
- Integration with Supabase and Clerk services

**Data Collection Layer (TypeScript/Puppeteer)**
- Y Combinator API integration for all companies with AI classification
- GitHub API integration for repository and star growth tracking  
- HuggingFace API for model and download metrics
- Comprehensive spearfish scoring algorithm with weighted criteria
- Daily data synchronization and score recalculation

**AI/ML Layer (External APIs)**
- Semantic search using OpenAI Embeddings API
- Company classification via LLM APIs (OpenAI GPT-4, Claude)
- Artifact suggestion engine using AI API calls
- Email personalization through LLM APIs
- Natural language processing via external AI services

**Database Layer (Supabase PostgreSQL + Redis)**
- Company profiles and historical data
- User profiles and activity tracking  
- Artifact templates and completion tracking
- Email campaigns and response analytics
- Cached search results and computed scores
- Real-time subscriptions for live data updates

**Authentication Layer (Clerk)**
- User registration and login flows
- Social authentication (Google, GitHub, LinkedIn)
- Session management and JWT tokens
- User profile management
- Role-based access control

### Data Models

**Company Entity (from YC API + Enhancements)**
```sql
companies:
  - id, yc_id, name, slug, website
  - batch, stage, team_size, launched_at, company_age_months
  - one_liner, long_description, industry, tags[]
  - is_hiring, is_ai_related, is_b2b_focused, spearfish_score
  - github_repos[], github_star_growth_monthly
  - huggingface_models[], huggingface_downloads
  - has_conference_presence, has_boring_name
  - last_updated, created_at
```

**User Profile (Supabase + Clerk)**
```sql
-- Supabase table synced with Clerk user data
user_profiles:
  - clerk_user_id (primary key, synced with Clerk)
  - experience_level, skills[], interests[], target_roles[]
  - spearfish_history[], artifact_completions[]
  - email_campaigns[], response_rates
  - created_at, updated_at
```

**Artifact Templates**
```sql
artifacts:
  - id, type, title, description
  - target_skills[], company_signals[]
  - implementation_guide, success_metrics
  - completion_rate, average_impact
```

### APIs and Integrations

**External Services:**
- **Supabase**: PostgreSQL database with real-time subscriptions
- **Clerk**: Authentication and user management
- **Y Combinator API**: Company data for target batches (W22, S22, W23)
- **GitHub API**: Repository data and activity metrics
- **HuggingFace API**: Model downloads and trending data
- **OpenAI API**: Embeddings, text generation, and analysis
- **Anthropic Claude API**: Advanced text processing

**Internal APIs:**
- Company Intelligence API for research generation
- Artifact Suggestion API for personalized recommendations
- Email Generation API for cold outreach creation
- Analytics API for user activity and success tracking

### Infrastructure Requirements

**Development Environment:**
- Docker containers for consistent development
- Local Supabase instance for development database
- Clerk development environment for auth testing
- Environment variable management for API keys (OpenAI, GitHub, Clerk, Supabase)
- Testing frameworks for unit and integration tests (Jest, Supertest)

**Production Environment:**
- Vercel/Netlify for frontend hosting with auto-deployment
- Supabase managed PostgreSQL with automatic backups
- Clerk production authentication service
- CDN for static assets and performance optimization
- Monitoring and logging infrastructure for system health
- CI/CD pipeline for automated deployment

## Development Roadmap

### Phase 1: Foundation MVP
**Core Infrastructure:**
- Clerk authentication setup with social login options
- Supabase database schema and basic CRUD operations
- YC API integration for all companies with AI classification
- Basic spearfish scoring algorithm with weighted criteria
- Company discovery interface showing all AI companies ranked by score
- Company profile pages with YC data + score breakdown explanation
- Basic "Spearfish" button that shows placeholder research

**Company Intelligence (Scoring-Based):**
- YC API integration for all AI companies with comprehensive scoring
- Multi-signal spearfish scoring with weighted criteria from article methodology
- Automated daily score recalculation based on fresh data
- Ranked display of all qualified companies by spearfish score

**Basic User Flow:**
- User can browse companies and view profiles
- User can "spearfish" a company and see research report
- User can view artifact suggestions (static list)
- Basic email template generation (fill-in-the-blank style)

### Phase 2: AI-Powered Intelligence
**Automated Company Research:**
- GitHub API integration for repository and star tracking
- HuggingFace API for model activity monitoring
- Automated spearfish score calculation with multiple signals
- Real-time company data updates and growth tracking

**Smart Artifact Suggestions:**
- AI-powered artifact recommendation engine
- Personalization based on user skills and company needs
- Dynamic artifact templates and implementation guides
- Progress tracking and completion metrics

**Enhanced Search and Discovery:**
- Improved filtering with technical signals (GitHub stars, growth rate)
- Company recommendation based on user preferences
- Advanced sorting and ranking algorithms

### Phase 3: Complete Spearfishing Platform
**Advanced Email System:**
- AI-powered email personalization and generation
- Contact identification and research automation
- Send timing optimization and A/B testing
- Response tracking and follow-up automation

**Artifact Creation Tools:**
- In-platform code editors and development tools
- Dashboard builders for business artifacts
- Presentation templates and design tools
- Portfolio integration and showcase features

**Analytics and Optimization:**
- User success tracking and conversion analytics
- Platform performance monitoring and optimization
- Machine learning model improvement based on user feedback
- Predictive modeling for company and artifact success

### Phase 4: Scale and Network Effects
**Community Features:**
- User success stories and case studies
- Artifact sharing and collaboration
- Mentor matching and coaching marketplace
- Alumni network and referral systems

**Advanced Intelligence:**
- Predictive hiring likelihood modeling
- Market trend analysis and company scoring updates
- Competitive intelligence and positioning insights
- Industry-specific specialization and expertise

**Enterprise Features:**
- Corporate partnerships and talent pipeline development
- Bulk user management and team analytics
- Custom artifact templates for specific industries
- Advanced email automation and campaign management

## Logical Dependency Chain

### Foundation First (Weeks 1-4)
1. **Clerk Authentication Integration** - Set up social auth and user management
2. **Supabase Database Setup** - Schema design and basic operations
3. **YC API Integration with Comprehensive Scoring** - Pull all AI companies and implement weighted spearfish scoring system
4. **Company Profile Pages** - Core UI component displaying YC data and score breakdown

### Core User Journey (Weeks 5-8)
5. **Company Discovery Interface** - Browse companies with basic search and filtering
6. **Spearfish Button and Research Display** - The central action and value delivery
7. **Basic Artifact Suggestions** - Bridge between research and action
8. **Email Template System** - Complete the core spearfishing loop

### Intelligence Layer (Weeks 9-16)
9. **GitHub API Integration** - Provides real technical signals for company scoring
10. **Company Scoring Algorithm** - Enables automatic curation and ranking
11. **AI Artifact Suggestions** - Makes artifact recommendations truly valuable
12. **Advanced Filtering** - Enhanced discovery with technical and growth signals

### Advanced Features (Weeks 17-24)
13. **Email Personalization AI** - Improves success rates significantly
14. **Artifact Creation Tools** - Reduces friction in artifact completion
15. **Analytics and Tracking** - Enables continuous improvement and user success measurement
16. **Contact Research** - Automates the final piece of successful outreach

### Key Milestones for Usability:
- **Week 4:** Users can browse companies and understand the spearfishing concept
- **Week 8:** Complete spearfishing journey possible (manual research, basic artifacts, template emails)
- **Week 12:** AI-powered intelligence makes recommendations truly valuable
- **Week 16:** Fully automated, personalized experience with high success rates

## Risks and Mitigations

### Technical Challenges

**Risk: API Rate Limiting and Data Quality**
- GitHub, LinkedIn, and other APIs have strict rate limits
- Data freshness and accuracy critical for user trust
**Mitigation:** 
- Implement intelligent caching and data update strategies
- Build redundant data sources and validation systems
- Design graceful degradation when APIs are unavailable

**Risk: AI Model Accuracy and Relevance**
- Artifact suggestions may be irrelevant or too difficult
- Email personalization could feel generic or inappropriate
**Mitigation:**
- Start with rule-based systems and gradually introduce ML
- Implement user feedback loops for continuous improvement
- Maintain human oversight for critical AI-generated content

### MVP Strategy and Scope

**Risk: Over-Engineering the Initial Product**
- Temptation to build complete AI system before validating core concept
- Complex features may delay user feedback and iteration
**Mitigation:**
- Start with manual research compilation to validate user interest
- Use static data and simple algorithms before building complex AI
- Focus on core user journey completion over feature sophistication

**Risk: Insufficient User Value in Early Versions**
- Manual research may not feel significantly better than user doing it themselves
- Without AI personalization, artifact suggestions may feel generic
**Mitigation:**
- Curate exceptionally high-quality manual research that users couldn't easily compile
- Focus on companies and insights that are genuinely hard to find elsewhere
- Emphasize speed and convenience over perfect personalization initially

### Resource and Market Constraints

**Risk: Legal and Ethical Concerns with Data Collection**
- YC API terms of service compliance
- GitHub API rate limiting and usage policies
- Privacy concerns with company and contact information gathering
**Mitigation:**
- Use official YC API which is designed for public access
- Implement proper rate limiting and caching for GitHub API
- Focus on publicly available information and transparent data usage
- Implement data retention policies and user privacy controls

**Risk: User Adoption and Behavior Change**
- Users may be reluctant to invest time in spearfishing vs. quick applications
- Success requires sustained effort which may lead to high churn
**Mitigation:**
- Design onboarding to demonstrate immediate value and quick wins
- Provide clear progress tracking and success metrics
- Build community features to maintain motivation and accountability

**Risk: Competition from Established Players**
- LinkedIn, Indeed, or other platforms could add similar features
- Large companies have more resources for AI development
**Mitigation:**
- Focus on specialized AI job market knowledge as competitive moat
- Build strong user habits and community before competitors can respond
- Emphasize quality and specialization over broad feature sets

## Appendix

### Research Findings

**Spearfishing Methodology Validation:**
- Article demonstrates successful approach used by hundreds of job seekers
- 70% of AI roles filled through hidden job market, not public postings
- Value-first approach generates 20%+ response rates vs. 2-3% for traditional applications
- Series A timing optimal for equity upside and hiring flexibility

**AI Job Market Analysis:**
- Y Combinator batches W22, S22, W23 represent 300+ potential target companies
- GitHub star growth and HuggingFace activity provide measurable technical signals
- B2B AI companies monetize faster and offer more stable career opportunities
- "Boring" company names correlate with technical focus and sustainable business models

### Technical Specifications

**Performance Requirements:**
- Company search results under 500ms response time
- Research generation completed within 30 seconds
- Support for 1000+ concurrent users in production
- 99.9% uptime for core discovery and research features

**Data Requirements:**
- Track 500+ AI companies with weekly data updates
- Maintain 6 months of historical GitHub and funding data
- Store user artifacts and email campaigns for portfolio building
- Implement GDPR-compliant data retention and deletion policies

**Integration Specifications:**
- GitHub API: 5000 requests/hour for repository monitoring
- HuggingFace API: Unlimited for public model data access
- Email APIs: 10,000 sends/month with tracking and analytics
- Database: PostgreSQL 13+ with read replicas for performance scaling