# Development Principles & Workflow

**Purpose:** Establish coding best practices, planning standards, and workflow processes to ensure continuity and maintainability.
**Applies To:** All developers (human and AI agents)
**Last Updated:** 2025-11-27

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Development Workflow](#development-workflow)
3. [Planning Requirements](#planning-requirements)
4. [To-Do List Management](#to-do-list-management)
5. [Code Review Process](#code-review-process)
6. [Documentation Standards](#documentation-standards)
7. [Coding Best Practices](#coding-best-practices)
8. [Testing Requirements](#testing-requirements)
9. [Git Workflow](#git-workflow)
10. [Handoff Protocol](#handoff-protocol)

---

## Core Principles

### 1. Plan Before Execution
**Never start coding without a plan.** Every non-trivial task must have:
- Clear problem statement
- Proposed solution approach
- Implementation plan with phases
- Success criteria
- Identified risks/dependencies

### 2. Document for Continuity
**Write documentation as if you won't be available tomorrow.** Future engineers should be able to:
- Understand what was done and why
- Continue work from any point
- Reproduce your decision-making process
- Find all relevant context quickly

### 3. Track Progress Explicitly
**Use to-do lists for all multi-step tasks.** This ensures:
- No steps are forgotten
- Progress is visible to stakeholders
- Work can be resumed after interruptions
- Context is never lost

### 4. Review Before Merging
**All code must be reviewed.** Reviews ensure:
- Code quality and consistency
- Adherence to patterns and standards
- Knowledge transfer across team
- Early bug detection

### 5. Test Thoroughly
**Testing is not optional.** All changes must include:
- Manual testing of happy paths
- Edge case validation
- Visual/UI verification (for frontend)
- Accessibility checks (for frontend)

---

## Development Workflow

### Standard Task Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RECEIVE TASK                                             │
│    - Read requirements carefully                            │
│    - Ask clarifying questions if needed                     │
│    - Understand acceptance criteria                         │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. RESEARCH & EXPLORATION (if needed)                       │
│    - Explore existing codebase                              │
│    - Identify affected files/components                     │
│    - Review related patterns and conventions                │
│    - Document findings in planning doc                      │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CREATE IMPLEMENTATION PLAN                               │
│    - Write detailed plan in docs/[feature]-spec.md          │
│    - Break down into phases                                 │
│    - Identify dependencies                                  │
│    - Get stakeholder approval                               │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. CREATE TO-DO LIST                                        │
│    - Use TodoWrite tool to create task list                 │
│    - One item per atomic unit of work                       │
│    - Include testing and documentation tasks                │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. EXECUTE PHASE BY PHASE                                   │
│    For each phase:                                          │
│    a. Mark to-do as in_progress                             │
│    b. Implement changes                                     │
│    c. Test changes (manual + visual)                        │
│    d. Mark to-do as completed                               │
│    e. Document any deviations or learnings                  │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. COMPREHENSIVE TESTING                                    │
│    - Run all test suites                                    │
│    - Manual testing of all affected flows                   │
│    - Visual verification (screenshot evidence)              │
│    - Accessibility checks                                   │
│    - Cross-browser/device testing (if UI)                   │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. CODE REVIEW                                              │
│    - Self-review all changes                                │
│    - Run code-reviewer agent (AI)                           │
│    - Request peer review (human, if available)              │
│    - Address all feedback                                   │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. DOCUMENTATION                                            │
│    - Update relevant docs (README, API docs, etc.)          │
│    - Add inline comments for complex logic                  │
│    - Update CHANGELOG if applicable                         │
│    - Create handoff document if work is incomplete          │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. COMMIT & PR                                              │
│    - Create clear commit messages                           │
│    - Reference related issues/tickets                       │
│    - Create PR with thorough description                    │
│    - Link to spec document                                  │
└─────────────────────────────────────────────────────────────┘
```

### When to Skip Steps

**You may skip the planning step ONLY if:**
- Task is a single trivial change (< 5 lines of code)
- Task is purely documentation
- Task is fixing a typo
- Task is updating a config value

**You may skip the to-do list ONLY if:**
- Task has fewer than 3 steps
- Task can be completed in one atomic operation
- Task is purely conversational/informational

**All other cases require full workflow.**

---

## Planning Requirements

### When Planning is Required

Planning is **mandatory** for:
- New feature development
- Refactoring existing code
- Database schema changes
- API endpoint creation/modification
- UI/UX changes
- Performance optimizations
- Security updates
- Bug fixes affecting multiple files

### Planning Document Structure

Every plan must be a markdown file in `docs/[feature]-spec.md` with:

#### 1. Header Metadata
```markdown
# [Feature Name] Specification

**Status:** [Planning | In Progress | Complete | Abandoned]
**Created:** YYYY-MM-DD
**Author:** [Name/Agent]
**Estimated Time:** X hours/days
**Related Issues:** #123, #456
```

#### 2. Quick Context
- Brief overview (2-3 sentences)
- Problem being solved
- Key decisions made

#### 3. Design Decisions
For each decision point:
- **Chosen Solution:** What you decided
- **Why this approach:** Rationale
- **Alternatives considered:** What you rejected and why
- **Trade-offs:** Pros/cons of chosen approach

#### 4. Implementation Guide
Break down into phases:
```markdown
### Phase 1: [Name] (Est: X min)
**File:** path/to/file.ts
**Changes:**
- Specific change 1
- Specific change 2

**Implementation Note:** Any gotchas or important details
```

#### 5. Testing Checklist
- [ ] Manual test case 1
- [ ] Manual test case 2
- [ ] Accessibility check
- [ ] Edge case testing

#### 6. File Reference
- **Files to Create (New)**: List all new files
- **Files to Modify (Existing)**: List all changes
- **Files to Reference (No Changes)**: Related files

#### 7. Success Criteria
Clear, measurable criteria for done:
- ✅ Criterion 1
- ✅ Criterion 2

#### 8. Risks & Dependencies
- **Risks:** What could go wrong
- **Dependencies:** What must be done first
- **Blockers:** Current obstacles

### Planning Document Template

```markdown
# [Feature Name] Specification

**Status:** Planning
**Created:** YYYY-MM-DD
**Author:** [Name]
**Estimated Time:** X hours

## Quick Context
[2-3 sentence overview]

## Problem Statement
[What are we solving and why?]

## Design Decisions

### Decision 1: [Topic]
**Chosen Solution:** [What we're doing]
**Why this approach:** [Rationale]
**Alternatives considered:** [Other options]
**Trade-offs:** [Pros/cons]

## Implementation Guide

### Phase 1: [Name] (Est: X min)
**File:** path/to/file
**Changes:**
- Change 1
- Change 2

## Testing Checklist
- [ ] Test 1
- [ ] Test 2

## File Reference
### Files to Create
- file1.ts
- file2.ts

### Files to Modify
- existing1.ts
- existing2.ts

## Success Criteria
✅ Criterion 1
✅ Criterion 2

## Risks & Dependencies
**Risks:** [What could go wrong]
**Dependencies:** [Prerequisites]
```

---

## To-Do List Management

### Creating To-Do Lists

**Always create a to-do list before starting execution.**

Use the `TodoWrite` tool with clear, actionable items:

```typescript
TodoWrite({
  todos: [
    {
      content: "Add user validation to signup endpoint",
      activeForm: "Adding user validation to signup endpoint",
      status: "pending"
    },
    {
      content: "Write unit tests for validation logic",
      activeForm: "Writing unit tests for validation logic",
      status: "pending"
    },
    {
      content: "Test signup flow end-to-end",
      activeForm: "Testing signup flow end-to-end",
      status: "pending"
    }
  ]
});
```

### To-Do Item Guidelines

Each to-do should:
- **Be atomic**: Represents one unit of work
- **Be specific**: Clear what needs to be done
- **Be testable**: You know when it's complete
- **Include both forms**:
  - `content`: Imperative form ("Add feature X")
  - `activeForm`: Present continuous ("Adding feature X")

### Updating To-Dos

**Update status immediately after each step:**

```typescript
// When starting a task
TodoWrite({
  todos: [
    { content: "Task 1", activeForm: "Doing task 1", status: "in_progress" },
    { content: "Task 2", activeForm: "Doing task 2", status: "pending" },
  ]
});

// After completing Task 1
TodoWrite({
  todos: [
    { content: "Task 1", activeForm: "Doing task 1", status: "completed" },
    { content: "Task 2", activeForm: "Doing task 2", status: "in_progress" },
  ]
});
```

### To-Do List Rules

1. **Exactly ONE task in_progress** at any time
2. **Complete tasks immediately** after finishing (don't batch)
3. **Never mark incomplete tasks as completed**
4. **Add new tasks** if you discover additional work
5. **Remove irrelevant tasks** rather than leaving them pending

### When a Task Cannot Be Completed

If you encounter blockers:
1. **Keep task as in_progress**
2. **Add new task** describing the blocker
3. **Document the issue** in the spec or a comment
4. **Notify stakeholders** about the blocker

Example:
```typescript
TodoWrite({
  todos: [
    {
      content: "Implement user search",
      activeForm: "Implementing user search",
      status: "in_progress" // Blocked, but keep in progress
    },
    {
      content: "Fix database connection error blocking user search",
      activeForm: "Fixing database connection error",
      status: "pending"
    }
  ]
});
```

---

## Code Review Process

### Self-Review Checklist

Before requesting review, verify:

#### Functionality
- [ ] Code does what it's supposed to do
- [ ] Edge cases are handled
- [ ] Error handling is comprehensive
- [ ] No console.log or debug code left behind

#### Code Quality
- [ ] Follows project conventions
- [ ] No code duplication
- [ ] Functions are small and focused
- [ ] Variable names are descriptive
- [ ] Complex logic has comments

#### Security
- [ ] No security vulnerabilities (XSS, injection, etc.)
- [ ] Sensitive data is protected
- [ ] User input is validated
- [ ] RLS policies are correct (if database changes)

#### Performance
- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] Unnecessary re-renders avoided (React)
- [ ] Large files/images are optimized

#### Testing
- [ ] Manual testing completed
- [ ] All test cases pass
- [ ] Visual verification done (for UI)
- [ ] Accessibility checked (for UI)

### Agent Review Process

For AI-assisted development, run the code-reviewer agent:

```bash
# Use the Task tool with code-reviewer agent
@agent-code-reviewer "Review the [feature name] implementation"
```

The agent will check:
- Code quality and patterns
- Security vulnerabilities
- Error handling
- Type safety
- Database/RLS considerations

### Human Review Process

When requesting human review:
1. **Link to spec document** in PR description
2. **Explain what changed** and why
3. **Highlight risks** or areas needing extra attention
4. **Provide test instructions** for reviewers
5. **Include screenshots** for UI changes

---

## Documentation Standards

### What to Document

#### Always Document:
- New features (spec document + inline comments)
- API endpoints (JSDoc + API docs)
- Complex algorithms (inline comments)
- Database schema changes (migration file + spec)
- UI components (JSDoc + usage examples)
- Configuration changes (README updates)

#### Commenting Philosophy

**CRITICAL RULE: Less is more. Self-documenting code > comments.**

- Write code that explains itself through clear naming and structure
- Only add comments when the "why" is not obvious from the code
- Never over-comment or state the obvious
- For complex exported functions, use JSDoc instead of inline comments

#### Inline Comments

**Use ONLY for:**
- **Why**, not **what**: Explain non-obvious reasoning
- **Gotchas**: Edge cases or unexpected behavior
- **TODOs**: Mark incomplete work (with issue references)
- **Security notes**: Explain sensitive operations
- **Complex algorithms**: When refactoring would make code worse

**NEVER comment:**
- Obvious operations (`// Create user`, `// Loop through items`)
- What the code does (the code itself says that)
- Every single line
- Simple variable assignments
- Standard patterns

**Good examples:**
```typescript
// Use SECURITY DEFINER to bypass RLS when creating user profiles
// This is safe because we validate the user ID matches the authenticated user
const result = await db.execute(query);

// GOTCHA: Supabase requires email confirmation before user can log in
// Users won't exist in public.users until they click the confirmation link
if (!user) return null;
```

**Bad examples (over-commenting):**
```typescript
// Create user profile
const profile = createProfile();

// Set user email
profile.email = email;

// Save to database
await db.save(profile);
```

**When to refactor instead of comment:**
```typescript
// ❌ BAD: Comment explaining complex condition
// Check if user is guest and not converting and has no email
if (user.isGuest && !req.body.convert && !user.email) { ... }

// ✅ GOOD: Self-documenting function
const isGuestWithoutConversion = user.isGuest && !req.body.convert && !user.email;
if (isGuestWithoutConversion) { ... }
```

#### JSDoc Comments

**Required for:**
- All exported functions
- All exported components
- All exported types/interfaces
- Public API methods
- Complex functions used in multiple places

**Optional for:**
- Private/internal functions (if logic is self-evident)
- Simple utility functions
- Obvious getters/setters

**JSDoc replaces inline comments** - don't duplicate:

```typescript
/**
 * Validates user credentials during signup.
 *
 * Checks email format, password strength, and ensures email is not already registered.
 *
 * @param email - User's email address
 * @param password - User's password (min 8 chars)
 * @returns Validation result with error messages if invalid
 * @throws BadRequestError if email format is invalid
 * @throws ConflictError if email already exists
 *
 * @example
 * ```typescript
 * const result = await validateSignup('user@example.com', 'password123');
 * if (!result.valid) {
 *   console.log(result.errors);
 * }
 * ```
 */
export async function validateSignup(
  email: string,
  password: string
): Promise<ValidationResult> {
  // No inline comments needed - JSDoc explains everything
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new BadRequestError('Invalid email format');
  }

  // Only comment non-obvious logic
  // Check existing users with case-insensitive email match
  // This prevents duplicate accounts with different casing
  const existing = await db.users.findOne({
    email: { $regex: new RegExp(`^${email}$`, 'i') }
  });

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  return { valid: true };
}
```

#### Comment Anti-Patterns

❌ **Don't**: Add comments that repeat the code
```typescript
// Set name to full name
const name = fullName;
```

❌ **Don't**: Comment every function parameter
```typescript
function updateUser(
  id, // user id
  email, // user email
  name // user name
) { }
// Use JSDoc instead ☝️
```

❌ **Don't**: Leave commented-out code
```typescript
// const oldWay = doSomething();
const newWay = doSomethingBetter();
// Delete old code, use git history if needed
```

❌ **Don't**: Write novels
```typescript
// This function handles user authentication by first checking if the user
// exists in the database, then validating their password hash against the
// stored hash, and finally generating a JWT token if everything matches...
// (20 more lines of comments)
```

✅ **Do**: Be concise and clear
```typescript
// Verify password hash before generating JWT
const isValid = await verifyHash(password, user.passwordHash);
```

### Documentation Files

#### README Files
Update when:
- Adding new scripts or commands
- Changing setup/installation process
- Adding new environment variables
- Changing deployment process

#### API Documentation
Create/update when:
- Adding new endpoints
- Changing request/response formats
- Modifying authentication
- Updating error codes

#### Spec Documents
Create for:
- All new features
- Significant refactors
- UI redesigns
- Database schema changes

#### CHANGELOG
Update for:
- Version releases
- Breaking changes
- Major features
- Important bug fixes

---

## Coding Best Practices

### TypeScript Standards

#### Type Safety
```typescript
// ✅ GOOD: Explicit types
interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  isGuest: boolean;
}

function updateProfile(profile: UserProfile): Promise<void> {
  // ...
}

// ❌ BAD: Any types
function updateProfile(profile: any) {
  // ...
}
```

#### Null Safety
```typescript
// ✅ GOOD: Handle null/undefined
const displayName = profile?.fullName ?? profile.guestName ?? 'Guest User';

// ❌ BAD: Assume exists
const displayName = profile.fullName;
```

### React Best Practices

#### Component Structure
```typescript
// ✅ GOOD: Server Component by default
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <ProfileView user={user} />;
}

// ❌ BAD: Unnecessary 'use client'
'use client';
export default function ProfilePage() {
  // Server component that doesn't need client features
}
```

#### State Management
```typescript
// ✅ GOOD: Minimal state
const [isEditing, setIsEditing] = useState(false);

// ❌ BAD: Derived state
const [isEditing, setIsEditing] = useState(false);
const [canEdit, setCanEdit] = useState(!isGuest); // Derive this instead
```

### Error Handling

#### API Routes
```typescript
// ✅ GOOD: Use asyncHandler wrapper
export const POST = asyncHandler(async (request: Request) => {
  const body = await request.json();
  validate(!body.email, 'Email is required');

  // ... implementation

  return NextResponse.json({ success: true });
});

// ❌ BAD: Manual try-catch everywhere
export async function POST(request: Request) {
  try {
    // ...
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
```

#### Client Components
```typescript
// ✅ GOOD: User-friendly error messages
try {
  await updateProfile(data);
  toast.success('Profile updated successfully');
} catch (error) {
  toast.error(error instanceof Error ? error.message : 'Failed to update profile');
}

// ❌ BAD: Generic or technical errors
try {
  await updateProfile(data);
} catch (error) {
  alert('Error'); // Too vague
  console.log(error); // Technical details exposed
}
```

### Database Best Practices

#### RLS Policies
```sql
-- ✅ GOOD: Specific, secure policy
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ❌ BAD: Overly permissive
CREATE POLICY "Users can update profiles"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (true);
```

#### Idempotent Migrations
```sql
-- ✅ GOOD: Safe to run multiple times
DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
  -- ...
);

-- ❌ BAD: Fails on second run
CREATE TABLE transactions (
  -- ...
);
```

### Security Best Practices

#### Input Validation
```typescript
// ✅ GOOD: Validate all inputs
const email = body.email?.trim().toLowerCase();
validate(!email, 'Email is required');
validate(!emailRegex.test(email), 'Invalid email format');

// ❌ BAD: Trust user input
const email = body.email;
await createUser(email);
```

#### Authentication
```typescript
// ✅ GOOD: Check auth in every protected route
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new UnauthorizedError('Authentication required');

// ❌ BAD: Assume user is authenticated
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
// No check, proceed with user operations
```

---

## Testing Requirements

### Manual Testing

**Every change must be manually tested before review.**

#### Testing Checklist (General)
- [ ] Happy path works as expected
- [ ] Error states handled gracefully
- [ ] Edge cases tested (empty data, max values, etc.)
- [ ] User feedback is clear (success/error messages)

#### UI-Specific Testing
- [ ] Visual verification (screenshot evidence)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Loading states shown
- [ ] Error states shown
- [ ] Empty states shown

#### Testing Tools

Use Playwright for visual verification:
```typescript
// Navigate to page
mcp__playwright__browser_navigate('http://localhost:3000/profile');

// Take screenshot for evidence
mcp__playwright__browser_take_screenshot({ fullPage: true });

// Check for console errors
mcp__playwright__browser_console_messages({ onlyErrors: true });

// Test interactions
mcp__playwright__browser_click({ element: 'Edit button', ref: '[ref]' });

// Verify accessibility
mcp__playwright__browser_snapshot();
```

### Automated Testing

**Write tests for:**
- Utility functions (pure logic)
- API endpoints (integration tests)
- Complex components (unit tests)
- Critical user flows (E2E tests)

**Don't test:**
- Trivial getters/setters
- Third-party library code
- Simple UI components with no logic

---

## Git Workflow

### Branch Naming
```
feature/user-authentication
bugfix/profile-update-error
refactor/database-queries
docs/api-documentation
```

### Commit Messages

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `docs`: Documentation
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(auth): add guest account conversion

Implement endpoint and UI for upgrading guest accounts to full accounts.
Includes validation to prevent duplicate emails.

Related: #123

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Pull Request Template

```markdown
## Summary
[Brief description of what this PR does]

## Related Issues
Closes #123

## Implementation
- Change 1
- Change 2
- Change 3

## Testing
- [x] Manual testing completed
- [x] Visual verification (screenshots attached)
- [x] Accessibility checked
- [ ] Automated tests added

## Spec Document
Link to: docs/[feature]-spec.md

## Screenshots
[Attach before/after screenshots for UI changes]

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented if necessary)
```

---

## Handoff Protocol

### When Work is Incomplete

If you must stop before completing a task:

#### 1. Update To-Do List
Mark current progress:
```typescript
TodoWrite({
  todos: [
    { content: "Phase 1 complete", status: "completed" },
    { content: "Phase 2 in progress - 60% done", status: "in_progress" },
    { content: "Phase 3 not started", status: "pending" }
  ]
});
```

#### 2. Create Handoff Document
```markdown
# [Feature Name] - Work in Progress

**Last Updated:** YYYY-MM-DD HH:MM
**Current Status:** 60% Complete
**Next Engineer:** [Name or "TBD"]

## What's Complete
✅ Phase 1: Database schema updated
✅ Phase 2: API endpoint partially implemented

## What's In Progress
🔄 Phase 2: API endpoint (60% complete)
- ✅ Request validation done
- ✅ Database query done
- ❌ Response formatting pending
- ❌ Error handling pending

## What's Remaining
⏳ Phase 3: Frontend UI
⏳ Phase 4: Testing
⏳ Phase 5: Documentation

## Current Blockers
- None currently

## Next Steps
1. Complete response formatting in /api/users/profile
2. Add error handling for edge cases
3. Begin frontend implementation

## Files Modified
- src/app/api/users/profile/route.ts (partial)
- database/migrations/003_add_profile_fields.sql (complete)

## Important Context
- Using new validation pattern from errors.ts
- Must maintain backward compatibility with existing profiles
- See spec doc: docs/profile-update-spec.md

## Questions for Next Engineer
1. Should we add rate limiting to this endpoint?
2. Confirm email validation regex is correct

## How to Continue
1. Read spec: docs/profile-update-spec.md
2. Review to-do list (TodoWrite tool)
3. Continue from Phase 2, step 3
4. Reference this handoff doc for context
```

#### 3. Update Spec Document
Add "Work in Progress" section to spec:
```markdown
## Work in Progress Notes

**Last Updated:** YYYY-MM-DD
**Current Progress:** 60% complete

### Completed
- Phase 1: Database schema
- Phase 2: API endpoint (partial)

### In Progress
- Phase 2: Response formatting

### Pending
- Phase 3-5

### Known Issues
- None

### Next Steps
See handoff doc: docs/[feature]-handoff.md
```

#### 4. Commit Work
```bash
git add .
git commit -m "WIP: [feature] - 60% complete (see handoff doc)

Completed Phase 1 and partial Phase 2.
Response formatting and error handling pending.

See docs/[feature]-handoff.md for continuation instructions.

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin feature/[branch-name]
```

---

## Quick Reference

### Before Starting Any Task
- [ ] Read and understand requirements
- [ ] Ask clarifying questions if needed
- [ ] Create spec document (if non-trivial)
- [ ] Create to-do list
- [ ] Get stakeholder approval (if needed)

### During Implementation
- [ ] Mark each to-do as in_progress before starting
- [ ] Test each change immediately after implementing
- [ ] Mark each to-do as completed immediately after finishing
- [ ] Document any deviations or learnings
- [ ] Keep spec document updated

### Before Requesting Review
- [ ] All to-dos marked as completed
- [ ] Self-review checklist completed
- [ ] Manual testing completed
- [ ] Visual verification done (for UI)
- [ ] Documentation updated
- [ ] Spec document finalized

### Before Merging
- [ ] Code review completed and approved
- [ ] All tests passing
- [ ] No console errors
- [ ] Accessibility verified (for UI)
- [ ] Breaking changes documented (if any)

---

## Compliance

**This document is mandatory for all development work.**

Engineers (human and AI) must follow these principles to ensure:
- Code quality and consistency
- Work continuity across team members
- Maintainable and documented codebase
- Reduced technical debt
- Faster onboarding for new team members

**Violations of these principles should be flagged in code review.**

---

**Last Updated:** 2025-11-27
**Owner:** Development Team
**Reviewers:** All Engineers

For questions or suggestions, open an issue with label `development-workflow`.
