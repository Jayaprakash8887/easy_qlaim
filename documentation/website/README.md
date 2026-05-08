# Easy Qlaim Promotional Website

A modern, premium promotional website for Easy Qlaim - AI-Powered Expense Management System.

## 🌟 Features

- **Light Blue Navbar**: Professional header with excellent logo visibility
- **Live Branding**: Actual logo and colors from production app
- **Indian Pricing**: ₹1,00,000 and ₹3,00,000 monthly plans
- **AI Agents Showcase**: Visual representation of multi-agent architecture
- **Responsive Design**: Mobile and desktop optimized
- **Multiple CTAs**: Direct links to live demo at https://easy-qlaim.tarento.dev

## 📁 Structure

```
website/
├── index.html       # Main HTML file
├── style.css        # All styling with teal theme
├── script.js        # Scroll animations
└── assets/          # Images and icons
    ├── logo.svg
    ├── favicon.png
    ├── hero.png
    ├── orchestrator.png
    ├── document.png
    ├── validation.png
    └── approval.png
```

## 🚀 Deployment to Netlify

### Option 1: Drag & Drop (Easiest)
1. Zip the entire `website` folder
2. Go to [Netlify](https://app.netlify.com/)
3. Drag and drop the zip file
4. Done! Your site will be live

### Option 2: Git Deploy (Recommended)
1. Push this folder to GitHub
2. Connect your GitHub repo to Netlify
3. Set build settings:
   - **Base directory**: `website`
   - **Build command**: (leave empty)
   - **Publish directory**: `.` or `website`
4. Deploy!

### Option 3: Netlify CLI
```bash
cd website
netlify deploy --dir=.
```

## 🎨 Customization

### Colors (in style.css)
- Primary Teal: `#009491`
- Dark Navy: `#14273E`
- Light Blue Header: `rgba(224, 247, 250, 0.98)`

### Pricing (in index.html)
Update the price values in the pricing section cards.

### Contact Links
Update the email in the "Contact Sales" button (currently `sales@easyqlaim.com`).

## 📝 SEO

The website includes:
- Meta description
- Favicon
- Semantic HTML
- Social media tags

## 🔗 Live Demo

The website links to: https://easy-qlaim.tarento.dev/login

## 📄 License

Created for Easy Qlaim AI Hackathon presentation.
