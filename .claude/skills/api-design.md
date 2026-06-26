# API Design Skill

## Purpose
This skill guides Claude in designing RESTful APIs that are consistent, maintainable, and follow industry best practices. It covers routing conventions, error handling, versioning, and response formatting.

## Core Principles

### 1. RESTful Conventions
- **HTTP Methods**: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- **Resources**: Nouns not verbs (`/users/123` not `/getUser/123`)
- **Hierarchy**: Nested routes for sub-resources (`/users/123/posts/456`)
- **Status Codes**:
  - 200: OK (successful GET, PUT, PATCH)
  - 201: Created (successful POST)
  - 204: No Content (successful DELETE)
  - 400: Bad Request (invalid input)
  - 401: Unauthorized (auth required)
  - 403: Forbidden (auth successful, permission denied)
  - 404: Not Found (resource doesn't exist)
  - 500: Internal Server Error (unexpected error)

### 2. Request/Response Format
- **Content-Type**: Always `application/json`
- **Request Body**: Flat structure (no nested resources in POST body)
- **Response Body**:
  ```json
  {
    "success": true,
    "data": { /* resource */ },
    "error": null
  }
  ```
- **Lists**: Always wrapped with metadata
  ```json
  {
    "success": true,
    "data": [/* items */],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
  ```

### 3. Error Handling
- **Consistent Error Format**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "User-friendly message",
      "details": [{ "field": "email", "issue": "already exists" }]
    }
  }
  ```
- **Error Codes**: VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, SERVER_ERROR
- **HTTP Status + Error Code**: Status code + semantic error code for clarity
- **Avoid**: Exposing stack traces, vague error messages, inconsistent formats

### 4. Pagination
- **Query Parameters**: `?page=1&limit=20`
- **Default Limit**: 20 items per page
- **Maximum Limit**: 100 items (prevent abuse)
- **Response Metadata**:
  ```json
  {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
  ```

### 5. Versioning
- **URL-based**: `/v1/users`, `/v2/users` (preferred)
- **Header-based**: `Accept: application/vnd.api+json;version=1` (alternative)
- **Never Remove Endpoints**: Deprecate instead
- **Deprecation Header**: `Deprecation: true` + `Sunset: 2024-12-31T00:00:00Z`

### 6. Authentication & Security
- **Bearer Tokens**: `Authorization: Bearer <token>`
- **HTTPS Only**: Never HTTP for production
- **CORS**: Whitelist specific origins, not `*`
- **Rate Limiting**: `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers
- **No Credentials in URL**: Never `/users?api_key=secret`

## Implementation Patterns

### Pattern 1: Express Router Setup
```typescript
import express, { Router, Request, Response } from 'express';
const router = Router();

router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    res.json({
      success: true,
      data: users,
      pagination: { page: 1, limit: 20, total: users.length }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' }
    });
  }
});
```

### Pattern 2: Error Handler Middleware
```typescript
app.use((error: any, req: Request, res: Response, next: any) => {
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'SERVER_ERROR';
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: { code: errorCode, message, details: error.details }
  });
});
```

### Pattern 3: Validation Middleware
```typescript
function validateBody(schema: any) {
  return (req: Request, res: Response, next: any) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.details.map(d => ({ field: d.path.join('.'), issue: d.message }))
        }
      });
    }
    req.body = value;
    next();
  };
}
```

### Pattern 4: Pagination Middleware
```typescript
function paginate(req: Request, res: Response, next: any) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  res.locals.pagination = { page, limit, skip };
  next();
}
```

## Design Checklist

- [ ] All endpoints follow RESTful conventions (nouns, HTTP methods)
- [ ] Response format is consistent across all endpoints
- [ ] Error handling returns proper status codes + semantic error codes
- [ ] Pagination is implemented for list endpoints
- [ ] Authentication uses Bearer tokens
- [ ] HTTPS enforced in production
- [ ] CORS configured with specific allowed origins
- [ ] Rate limiting headers included
- [ ] Validation runs before business logic
- [ ] No stack traces exposed to clients
- [ ] Consistent error message format
- [ ] API versioning strategy documented
- [ ] Endpoint timeout (30s) configured
- [ ] Logging captures requests/responses

## Anti-Patterns to Avoid

- Verb-based endpoints (`/getUsers`, `/createPost`)
- Inconsistent response formats
- HTTP 200 with error in response body
- Exposing stack traces to clients
- No pagination on list endpoints
- Credentials in URLs
- No error codes (status codes only)
- SQL errors exposed directly
- Missing Content-Type headers
- Unvalidated input reaching database
- No rate limiting
- Inconsistent status code usage

## When to Apply

- Building REST APIs
- Designing microservices
- Creating public APIs for third-party integration
- Migrating to new API versions
- Building internal service-to-service APIs
- Designing webhooks

## Success Metrics

- Can third parties understand and use the API without documentation?
- Are error responses helpful and actionable?
- Are status codes semantically correct?
- Is the response format consistent across all endpoints?
- Can clients easily implement pagination?
- Are authentication requirements clear?
- Do error messages guide developers toward solutions?

## References

- https://restfulapi.net/
- https://jsonapi.org/
- https://tools.ietf.org/html/rfc7231
- https://owasp.org/www-community/attacks/REST_Assessment
