# MindCare CRM - Mental Health Practice Management System

## Overview

MindCare CRM is a comprehensive mental health practice management system designed specifically for therapists, clinicians, and mental health practices. The application provides secure patient management, appointment scheduling, treatment documentation, and practice analytics while maintaining HIPAA compliance standards.

## System Architecture

The application follows a full-stack TypeScript architecture with a modern web stack:

**Frontend Architecture:**
- React 18 with TypeScript for the user interface
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query for server state management and caching
- Tailwind CSS with shadcn/ui component library for styling
- React Hook Form with Zod validation for form handling

**Backend Architecture:**
- Express.js server with TypeScript
- RESTful API design with structured route handling
- Middleware-based request processing and logging
- Session-based authentication using Replit Auth

**Database Layer:**
- PostgreSQL database with Neon serverless connection
- Drizzle ORM for type-safe database operations
- Structured schema with relationships between entities
- Migration support for database version control

## Key Components

**Authentication System:**
- Replit OpenID Connect (OIDC) integration
- Session management with PostgreSQL storage
- Role-based access control (admin, therapist, staff)
- Secure authentication middleware

**Patient Management:**
- Comprehensive patient profiles with personal and medical information
- HIPAA consent tracking and emergency contact management
- Patient status management (active, inactive, discharged)
- Therapist assignment and caseload management

**Appointment System:**
- Appointment scheduling with multiple duration options
- Status tracking (scheduled, in-progress, completed, cancelled)
- Integration with patient and therapist records
- Calendar-based appointment management

**Treatment Documentation:**
- Structured treatment record creation and storage
- Session notes, goals, interventions, and progress tracking
- Treatment plan documentation with next session planning
- Secure storage of sensitive clinical information

**Dashboard and Analytics:**
- Practice overview with key performance indicators
- Recent patient activity and today's schedule
- Quick action buttons for common tasks
- Statistical reporting and practice insights

## Data Flow

1. **User Authentication:** Users authenticate through Replit OIDC, creating secure sessions stored in PostgreSQL
2. **Patient Data Management:** Patient information flows through validated forms to the database via Drizzle ORM
3. **Appointment Scheduling:** Appointments link patients with therapists through foreign key relationships
4. **Treatment Records:** Clinical notes and treatment data are securely stored with audit logging
5. **Dashboard Aggregation:** Statistical data is computed server-side and cached client-side using TanStack Query

## External Dependencies

**Primary Dependencies:**
- `@neondatabase/serverless`: PostgreSQL serverless connection for Neon database
- `drizzle-orm` & `drizzle-kit`: Type-safe ORM and migration tools
- `@tanstack/react-query`: Server state management and caching
- `@radix-ui/*`: Accessible UI primitives for component library
- `react-hook-form` & `@hookform/resolvers`: Form handling with validation
- `zod`: Runtime type validation and schema definition
- `tailwindcss`: Utility-first CSS framework

**Authentication:**
- `openid-client` & `passport`: OpenID Connect authentication
- `express-session` & `connect-pg-simple`: Session management
- Custom Replit Auth integration

**Development Tools:**
- `vite`: Build tool and development server
- `typescript`: Static type checking
- `tsx`: TypeScript execution for development
- `esbuild`: Production bundling for server code

## Deployment Strategy

**Development Environment:**
- Vite development server with HMR support
- TypeScript compilation with incremental builds
- Database migrations using Drizzle Kit
- Environment-specific configuration management

**Production Build:**
- Client-side bundling with Vite for optimized assets
- Server-side bundling with esbuild for Node.js deployment
- Static asset serving with Express
- Database connection pooling for production loads

**Environment Configuration:**
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Session encryption key (required)
- `REPLIT_DOMAINS`: Allowed domains for OIDC (required)
- `ISSUER_URL`: OIDC issuer URL (optional, defaults to Replit)

**Database Management:**
- Schema definitions in `shared/schema.ts`
- Migrations generated in `./migrations` directory
- Push-based deployment with `npm run db:push`
- Automated table creation for session storage

## Changelog

```
Changelog:
- July 02, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```