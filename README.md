# Placify - Job Portal Platform

Placify is a comprehensive job portal platform that connects students with recruiters. It provides a seamless experience for job posting, application management, and company reviews.

**Live Application**: [https://placify-app.vercel.app/](https://placify-app.vercel.app/)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [License](#license)

## Features

### For Students
- Browse and search for jobs
- Apply to jobs with resume upload
- Bookmark favorite jobs
- Track application status
- View company reviews and ratings
- Manage profile and resume

### For Recruiters
- Create and manage company profiles
- Post and manage job listings
- Review and manage job applications
- Receive notifications for expiring jobs
- View analytics and statistics
- Customize job posting settings

### For Admins
- Manage users, jobs, and companies
- Oversee platform activity
- Handle disputes and reports

### Additional Features
- Company review and rating system
- AI-powered job description generation
- Automated notifications
- Responsive design for all devices
- Role-based access control
- Comprehensive logging and error handling

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication and authorization
- **Cloudinary** - Image and file storage
- **Winston** - Logging
- **Nodemon** - Development server auto-restart

### Security
- **Helmet** - Security headers
- **CORS** - Cross-Origin Resource Sharing
- **Rate Limiting** - API rate limiting
- **MongoDB Sanitization** - Prevent NoSQL injection
- **XSS Protection** - Prevent cross-site scripting

### Additional Tools
- **OpenRouter API** - AI-powered features
- **Node-cron** - Scheduled tasks
- **UUID** - Unique identifier generation

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
MVC Pattern:
├── Models (Data layer)
├── Controllers (Business logic)
├── Routes (API endpoints)
├── Middleware (Request processing)
└── Utils (Helper functions)
```

### Key Design Patterns
- **MVC Architecture** - Separation of data, logic, and presentation
- **Middleware Pattern** - Request processing pipeline
- **Singleton Pattern** - Database connections and logger
- **Factory Pattern** - Response handling

## Getting Started

### Prerequisites
- Node.js >= 14.x
- MongoDB database (local or cloud)
- Cloudinary account for file storage
- OpenRouter API key for AI features

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd placify-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see below)

4. Start the development server:
```bash
npm run dev
```

5. For production:
```bash
npm start
```

## API Documentation

The API is organized into the following resource categories:

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Jobs
- `POST /api/jobs` - Create a new job
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get job by ID
- `PATCH /api/jobs/:id` - Update a job
- `DELETE /api/jobs/:id` - Delete a job
- `POST /api/jobs/:jobId/apply` - Apply to a job

### Companies
- `POST /api/companies` - Create a company
- `GET /api/companies` - Get all companies
- `GET /api/companies/:id` - Get company by ID
- `PATCH /api/companies/:id` - Update a company
- `DELETE /api/companies/:id` - Delete a company

### Applications
- `GET /api/applications` - Get all applications
- `GET /api/applications/:id` - Get application by ID
- `PATCH /api/applications/:id` - Update application status
- `DELETE /api/applications/:id` - Delete an application

### Users
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update user profile
- `POST /api/users/resume` - Upload user resume

### Reviews
- `POST /api/reviews/:companyId` - Create a review
- `GET /api/reviews/:companyId` - Get company reviews
- `PATCH /api/reviews/:id` - Update a review
- `DELETE /api/reviews/:id` - Delete a review

### Dashboard
- `GET /api/dashboard/student/overview` - Student dashboard overview
- `GET /api/dashboard/recruiter/overview` - Recruiter dashboard overview
- `GET /api/dashboard/admin/overview` - Admin dashboard overview

## Project Structure

```
backend/
├── config/              # Configuration files
├── controllers/         # Request handlers
├── cronJobs/            # Scheduled tasks
├── logs/                # Log files
├── middleware/          # Custom middleware
├── models/              # Database models
├── routes/              # API routes
├── scripts/             # Utility scripts
├── utils/               # Helper functions
├── .env                 # Environment variables
├── server.js            # Application entry point
└── package.json         # Project dependencies
```

## Key Components

### User Roles
1. **Student** - Can browse jobs, apply, and review companies
2. **Recruiter** - Can post jobs, manage applications, and create company profiles
3. **Admin** - Can manage all aspects of the platform

### Data Models
- **User** - Handles authentication, profiles, and role-based permissions
- **Job** - Job listings with all relevant details
- **Company** - Company profiles with verification and rating systems
- **Application** - Job applications with status tracking
- **Review** - Company reviews and ratings
- **Notification** - User notifications system

### Middleware
- **Authentication** - JWT-based authentication
- **RBAC** - Role-based access control
- **Validation** - Request data validation
- **Rate Limiting** - API rate limiting
- **Security** - Helmet, CORS, sanitization

### Utilities
- **Response Handler** - Standardized API responses
- **Logger** - Comprehensive logging system
- **Error Codes** - Standardized error handling
- **Cloudinary** - File upload handling
- **Notification Helpers** - Notification creation

## License

All Rights Reserved. See [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Seron Senapati