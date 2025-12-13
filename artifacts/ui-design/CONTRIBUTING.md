# Contributing to Reinvo-Dash

Thank you for your interest in contributing to Reinvo-Dash! This document provides guidelines and best practices for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun runtime
- Git
- Code editor (VS Code recommended)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/reinvo-dash.git
   cd reinvo-dash
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Development Workflow

### 1. Code Style

- Use TypeScript for all new files
- Follow existing code structure and patterns
- Use functional components with hooks
- Keep components small and focused
- Use meaningful variable and function names

### 2. Component Guidelines

**Creating a New Component:**

```typescript
// src/components/feature/MyComponent.tsx
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
  title: string;
  // ... other props
}

export function MyComponent({ className, title }: MyComponentProps) {
  return (
    <div className={cn('base-classes', className)}>
      <h3>{title}</h3>
    </div>
  );
}
```

**Component Checklist:**
- [ ] TypeScript interfaces for all props
- [ ] Proper prop destructuring
- [ ] className support for style overrides
- [ ] Accessibility attributes (ARIA)
- [ ] Responsive design considerations
- [ ] Loading and error states

### 3. Type Definitions

Add type definitions to appropriate files in `src/types/`:

```typescript
// src/types/index.ts or src/types/feature.ts
export interface MyType {
  id: string;
  name: string;
  // ... other fields
}
```

### 4. Styling

- Use Tailwind CSS utility classes
- Follow existing color scheme (defined in `tailwind.config.ts`)
- Ensure mobile responsiveness
- Use CSS variables for theme colors

```typescript
// Good
<div className="rounded-lg border bg-card p-4">

// Avoid inline styles unless necessary
<div style={{ padding: '16px' }}>
```

### 5. Forms and Validation

Use React Hook Form + Zod:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  // ...
}
```

## 🔍 Code Review Process

### Before Submitting PR

1. **Lint your code:**
   ```bash
   npm run lint
   ```

2. **Build successfully:**
   ```bash
   npm run build
   ```

3. **Test manually:**
   - Test your feature in the browser
   - Check different screen sizes
   - Verify no console errors

4. **Update documentation:**
   - Update README.md if needed
   - Add JSDoc comments for complex functions
   - Update type definitions

### PR Guidelines

**Good PR Title Examples:**
- `feat: add claim search functionality`
- `fix: resolve date picker timezone issue`
- `docs: update installation instructions`
- `refactor: simplify approval queue logic`

**PR Description Should Include:**
- What changed and why
- Screenshots (for UI changes)
- Testing steps
- Related issue numbers

## 📚 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Examples

```bash
feat(claims): add export to CSV functionality

- Added ExportButton component
- Implemented CSV generation logic
- Updated ClaimsList page

Closes #123
```

```bash
fix(forms): resolve date picker validation issue

The date picker was not properly validating future dates.
Fixed by adding proper date comparison in the schema.
```

## 🏗️ Project Structure

### Directory Organization

```
src/
├── components/     # Reusable components
│   ├── ui/        # Base UI components (shadcn)
│   ├── claims/    # Domain-specific components
│   ├── dashboard/
│   └── layout/
├── pages/         # Route components
├── hooks/         # Custom hooks
├── lib/           # Utilities
├── types/         # TypeScript types
├── contexts/      # React contexts
└── config/        # Configuration files
```

### When to Create a New...

**Component:**
- It's reused in multiple places
- It's complex enough to deserve its own file
- It has clear, focused responsibility

**Hook:**
- Logic is reused across components
- State management needs to be shared
- Side effects need to be abstracted

**Type:**
- Interface is used in multiple files
- Type is part of public API
- Complex type needs documentation

## 🐛 Bug Reports

### Creating an Issue

Include:
1. **Description** - Clear description of the bug
2. **Steps to Reproduce** - Numbered steps
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Screenshots** - If applicable
6. **Environment:**
   - Browser and version
   - OS
   - Node version

### Example

```markdown
**Bug: Claim submission fails with large files**

**Steps to Reproduce:**
1. Go to New Claim page
2. Upload a file larger than 10MB
3. Fill out form and click Submit
4. See error

**Expected:** File uploads successfully
**Actual:** Shows "Upload failed" error

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Node: 18.17.0

**Screenshots:**
[Attach screenshot]
```

## 💡 Feature Requests

Include:
1. **Problem Statement** - What problem does this solve?
2. **Proposed Solution** - How should it work?
3. **Alternatives Considered** - Other approaches?
4. **Use Cases** - Real-world scenarios
5. **Mockups** - Visual representation (if applicable)

## 🧪 Testing Guidelines

### Manual Testing Checklist

For new features:
- [ ] Works in latest Chrome
- [ ] Works in latest Firefox
- [ ] Works in latest Safari
- [ ] Responsive on mobile (375px)
- [ ] Responsive on tablet (768px)
- [ ] Responsive on desktop (1920px)
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Accessible (keyboard navigation)

## 📦 Adding Dependencies

Before adding a new dependency:

1. **Check if it's necessary** - Can existing tools do this?
2. **Check bundle size** - Use [Bundlephobia](https://bundlephobia.com)
3. **Check maintenance** - Is it actively maintained?
4. **Check security** - Any known vulnerabilities?

**To add a dependency:**
```bash
npm install package-name
```

## 🎨 Design System

### Colors

Use semantic color names from the theme:

```typescript
className="bg-primary text-primary-foreground"
className="bg-destructive text-destructive-foreground"
className="bg-muted text-muted-foreground"
```

### Spacing

Follow Tailwind's spacing scale:
- `p-2` (0.5rem / 8px)
- `p-4` (1rem / 16px)
- `p-6` (1.5rem / 24px)
- `p-8` (2rem / 32px)

### Typography

```typescript
className="text-sm"    // 14px
className="text-base"  // 16px
className="text-lg"    // 18px
className="text-xl"    // 20px
className="text-2xl"   // 24px
```

## 🔐 Security

- Never commit sensitive data (API keys, passwords)
- Use environment variables for configuration
- Validate all user inputs
- Sanitize data before rendering
- Follow OWASP best practices

## 📞 Getting Help

- Check existing issues and discussions
- Read the [README.md](./README.md)
- Ask in discussions for questions
- Tag maintainers for urgent issues

## 🙏 Thank You

Thank you for contributing to Reinvo-Dash! Your efforts help make expense management better for everyone.

## 📜 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

