## Deployment and user scope

This is a private, single-user application.

The application is intended to run on the owner's mini PC and must not be
designed as a public website, SaaS platform or multi-tenant application.

Do not implement:

- public registration;
- multiple user accounts;
- organizations or teams;
- role-based access control beyond a single owner role;
- social login;
- public profiles;
- subscription or payment systems;
- marketing pages;
- SEO features;
- public APIs.

The Next.js application is a private operational dashboard.

All secrets, AI provider credentials and exchange credentials must remain
server-side.

The dashboard may be accessed only through:

- localhost;
- an authorized private LAN;
- or a private VPN.

PostgreSQL, Redis, internal APIs and administrative ports must not be exposed
directly to the public internet.