# 🚀 Quick Start Guide - Reinvo-Dash

Welcome! This guide will help you get Reinvo-Dash up and running in minutes.

## ⚡ Super Quick Start (3 Steps)

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open your browser
# Visit: http://localhost:8080
```

That's it! The app is now running. 🎉

---

## 🎯 First Time Using the App?

### Default User
The app currently uses mock data. You're automatically logged in as:
- **Name**: John Doe
- **Role**: Employee (you can switch roles using the header dropdown)

### What to Try First

1. **Dashboard** (/) 
   - See your expense summary
   - View recent activity
   - Check AI suggestions

2. **Submit a Claim** (/claims/new)
   - Choose a category (Travel, Meals, etc.)
   - Fill out the smart form
   - Upload documents (drag & drop)
   - See real-time policy checks

3. **View Claims** (/claims)
   - See all your submitted claims
   - Filter and search
   - Click to see details

4. **Try Different Roles**
   - Click your name in the header
   - Select "Switch Role"
   - Try Manager, HR, or Finance role
   - Notice how the menu changes!

---

## 🔧 Common Commands

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check code quality
npm run lint
```

---

## 📁 Project Structure (Simplified)

```
reinvo-dash/
├── src/
│   ├── pages/           # Each page of the app
│   ├── components/      # Reusable UI pieces
│   ├── data/           # Mock data (temporary)
│   └── types/          # TypeScript types
├── public/             # Static files
└── package.json        # Dependencies
```

---

## 🎨 Key Pages

| Route | Page | What You'll See |
|-------|------|-----------------|
| `/` | Dashboard | Overview, stats, recent activity |
| `/claims` | Claims List | All your expense claims |
| `/claims/new` | New Claim | Submit a new claim |
| `/claims/:id` | Claim Details | View specific claim |
| `/approvals` | Approval Queue | Claims waiting for approval (Manager+) |
| `/allowances` | Allowances | View and manage allowances |
| `/employees` | Employees | Employee management (HR only) |
| `/projects` | Projects | Project tracking (HR/Finance) |
| `/settlements` | Settlements | Payment processing (Finance) |
| `/reports` | Reports | Analytics and reports |
| `/profile` | Profile | Your user profile |
| `/settings` | Settings | System settings (Admin only) |

---

## 👤 User Roles

The app has 5 different roles:

1. **Employee** 👔
   - Submit claims
   - View own claims
   - Track status

2. **Manager** 👨‍💼
   - All Employee features
   - Approve team claims
   - View team reports

3. **HR** 👥
   - All Manager features
   - Manage employees
   - Edit claim details
   - Manage allowances

4. **Finance** 💰
   - All HR features
   - Final approval
   - Process settlements
   - Financial reports

5. **Admin** ⚙️
   - Full system access
   - User management
   - System settings

**Switch roles** by clicking your name in the header!

---

## 🎮 Interactive Features to Try

### 1. Smart Claim Form
- Go to "New Claim"
- Choose any category
- Notice the compliance score updating as you type
- See policy checks in real-time

### 2. Document Upload
- Drag and drop a file
- See the OCR simulation (coming soon: real OCR)
- Notice confidence indicators

### 3. Approval Queue (Manager Role)
- Switch to Manager role
- Go to "Approvals"
- Use keyboard shortcuts:
  - `←` Previous claim
  - `→` Next claim
  - Swipe on mobile!

### 4. Filters & Search
- Go to "Claims" page
- Try filtering by status
- Use the search box
- Sort by different columns

---

## 🔥 Cool Features

- ✨ **AI Confidence Scores** - See how confident the AI is
- 📄 **OCR Preview** - Document scanning simulation
- 🔄 **Real-time Validation** - Instant policy checks
- 📊 **Analytics Dashboard** - Visual data representation
- 💬 **Comment System** - Collaborate on claims
- 🎯 **Role-Based UI** - Interface adapts to your role
- 📱 **Mobile Friendly** - Works great on phones
- 🌙 **Dark Mode Ready** - Theme support (coming soon)

---

## ❓ FAQ

**Q: Is the data real?**
A: No, currently it's mock data. Backend integration is planned.

**Q: Can I change the mock data?**
A: Yes! Check `src/data/mockClaims.ts` and similar files.

**Q: How do I add a new page?**
A: 
1. Create file in `src/pages/`
2. Add route in `src/App.tsx`
3. Add to navigation in `src/config/navigation.ts`

**Q: Where are the components?**
A: In `src/components/` organized by feature (claims, dashboard, etc.)

**Q: Can I use this in production?**
A: Frontend is production-ready! You'll need to connect a backend API.

**Q: How do I customize the theme?**
A: Edit colors in `tailwind.config.ts` and `src/index.css`

---

## 🆘 Troubleshooting

### Port 8080 is already in use
```bash
# Use a different port
npm run dev -- --port 3000
```

### Dependencies won't install
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
# Check for TypeScript errors
npm run build
# Fix any errors shown
```

### Page is blank
- Check the browser console (F12)
- Look for error messages
- Try clearing cache (Ctrl+Shift+R)

---

## 📚 Learn More

- **Full Documentation**: See [README.md](./README.md)
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Changelog**: See [CHANGELOG.md](./CHANGELOG.md)

---

## 💡 Tips for Developers

1. **Use TypeScript**: The project is fully typed - let your IDE help you!
2. **Check Examples**: Look at existing components before creating new ones
3. **Follow Patterns**: Use the same patterns for consistency
4. **Test as You Go**: Check your changes in the browser frequently
5. **Read Comments**: There are helpful comments in the code

---

## 🎓 Learning Path

**New to React?**
1. Start with simple pages (Dashboard, Profile)
2. Look at how components are used
3. Understand props and state
4. Try modifying existing features

**New to TypeScript?**
1. Check `src/types/index.ts`
2. See how types are used in components
3. Let your IDE show you type hints
4. Fix type errors as you code

**New to Tailwind?**
1. Look at existing className usage
2. Check [Tailwind docs](https://tailwindcss.com)
3. Use utility classes instead of custom CSS
4. Follow the existing color scheme

---

## 🎉 You're Ready!

You now know how to:
- ✅ Run the application
- ✅ Navigate the interface
- ✅ Switch between roles
- ✅ Try key features
- ✅ Find your way around the code

**Next steps:**
1. Explore the app
2. Try different features
3. Read the full README
4. Start contributing!

Need help? Check the [README.md](./README.md) for detailed documentation.

Happy coding! 🚀

