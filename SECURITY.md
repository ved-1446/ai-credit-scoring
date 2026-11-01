# Security Policy

## Reporting a Security Vulnerability

If you discover a security vulnerability in this project, please report it privately:
- Open a **private security advisory** on GitHub under the repository's "Security" tab.
- Alternatively, contact the repository owner through their **GitHub profile**.

**Please do not submit public GitHub issues or public pull requests for security vulnerabilities.**

## What Is in Scope

The following areas are in scope for security review:
- Authentication, session validation, and JWT verification mechanisms.
- Role-based authorization controls (ensuring applicant endpoints cannot access admin routes or unauthorized predictions).
- Server-side input validation, rate limiting, and output safety guards in API routes.
- Protection against secret leakage in repository files and logs.

## Demo Data Warning

Data Dynamo is strictly an **educational demonstration** and machine learning portfolio project:
- Never submit real-world personally identifiable information (PII), real financial documents, credit card numbers, or real identity credentials.
- Free-tier Google Gemini API processing may retain prompt data according to Google's free-tier terms of service.
- The default ML model is trained on public synthetic/anonymized Kaggle data and must never be used for actual loan or lending credit determinations.

