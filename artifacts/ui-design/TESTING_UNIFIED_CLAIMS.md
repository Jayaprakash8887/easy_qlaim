# Testing Guide: Unified Claim Submission

## 🧪 How to Test the New Feature

### Prerequisites
```bash
# Make sure the app is running
npm run dev

# Open browser at: http://localhost:8080
```

---

## Test Case 1: Reimbursement Flow ✅

### Steps:
1. **Navigate to New Claim**
   - Click "New Claim" in the sidebar
   - OR go to http://localhost:8080/claims/new

2. **Select Claim Type** (Step 1)
   - ✅ You should see two cards: "Reimbursement" and "Allowance"
   - ✅ Click the **"Reimbursement"** card
   - ✅ Card should highlight with ring border
   - ✅ Click "Continue" button

3. **Select Category** (Step 2)
   - ✅ You should see expense categories (Travel, Meals, etc.)
   - ✅ Click any category (e.g., "Travel")
   - ✅ Click "Continue"

4. **Fill Details** (Step 3)
   - ✅ Smart form should appear
   - ✅ Fill in required fields:
     - Title: "Business Trip to Mumbai"
     - Amount: "15000"
     - Date: Select today's date
     - Vendor: "MakeMyTrip"
   - ✅ Upload a document (drag & drop or click)
   - ✅ Watch compliance score update
   - ✅ Click "Continue"

5. **Review & Submit** (Step 4)
   - ✅ Review screen shows all entered data
   - ✅ Click "Submit Claim"
   - ✅ Success toast appears
   - ✅ Redirects to claims list

### Expected Results:
- ✅ No errors in console
- ✅ All steps flow smoothly
- ✅ Back button works at each step
- ✅ Step indicators update correctly
- ✅ Success message on submission

---

## Test Case 2: Allowance Flow ✅

### Steps:
1. **Navigate to New Claim**
   - Go to http://localhost:8080/claims/new
   - OR http://localhost:8080/allowances/new (should work too!)

2. **Select Claim Type** (Step 1)
   - ✅ Click the **"Allowance"** card
   - ✅ Card should highlight
   - ✅ Click "Continue"

3. **Select Allowance Type** (Step 2)
   - ✅ You should see 4 allowance policy cards:
     - On-Call Allowance (₹5,000)
     - Shift Allowance (₹8,000)
     - Work Incentive (₹15,000)
     - Food Allowance (₹3,000)
   - ✅ Each card shows:
     - Icon
     - Name
     - Max amount
     - Taxable badge
     - Description
     - Eligibility rules
   - ✅ Click any allowance (e.g., "Shift Allowance")
   - ✅ Card should highlight
   - ✅ Click "Continue"

4. **Fill Allowance Details** (Step 3)
   - ✅ Allowance form should appear
   - ✅ Fill in fields:
     - Amount: "7500" (must be ≤ max amount)
     - Period Start: "2024-12-01"
     - Period End: "2024-12-31"
     - Description: "Night shift duties for December"
     - Project Code: "PRJ-2024-100" (optional)
   - ✅ Policy requirements shown at bottom
   - ✅ Click "Continue"

5. **Review & Submit** (Step 4)
   - ✅ Review screen shows:
     - Allowance Type
     - Amount
     - Period dates (formatted nicely)
     - Description
     - Project code
     - Tax status badge
   - ✅ Click "Submit Claim"
   - ✅ Success toast appears: "Allowance Claim Submitted Successfully!"
   - ✅ Redirects to claims list

### Expected Results:
- ✅ No errors in console
- ✅ Amount validation works (can't exceed max)
- ✅ All form fields save correctly
- ✅ Review screen shows proper formatting
- ✅ Success message on submission

---

## Test Case 3: Navigation & Validation ✅

### Back Button Test:
1. Start new claim
2. Select Reimbursement
3. Click "Continue"
4. Click "Back" button
   - ✅ Should return to claim type selection
   - ✅ Previous selection should still be highlighted
5. Click "Continue" again
   - ✅ Should remember your choice

### Validation Tests:

#### Test 3.1: Can't skip steps
1. Start new claim
2. DON'T select anything
3. Click "Continue"
   - ✅ Should show error: "Please select a claim type"
   - ✅ Should NOT proceed to next step

#### Test 3.2: Reimbursement validation
1. Select Reimbursement
2. Skip category selection
3. Click "Continue"
   - ✅ Should show error: "Please select a category"

#### Test 3.3: Allowance validation
1. Select Allowance
2. Select an allowance type
3. Click "Continue"
4. Leave amount empty
5. Click "Continue"
   - ✅ Should show error: "Please enter the amount"

#### Test 3.4: Amount limit validation
1. Select Allowance
2. Select "Shift Allowance" (max: ₹8,000)
3. Try to enter amount: "10000"
   - ✅ Form should accept it (validation shown in UI)
   - Note: Backend would reject this, but UI shows the limit

---

## Test Case 4: Responsive Design ✅

### Desktop (1920px):
1. Open new claim
   - ✅ Cards should be side-by-side
   - ✅ Step indicators show full labels
   - ✅ Forms are centered and well-spaced

### Tablet (768px):
1. Resize browser to 768px width
   - ✅ Cards should remain in grid
   - ✅ Step indicators adapt
   - ✅ Forms stack nicely

### Mobile (375px):
1. Open on mobile or resize to 375px
   - ✅ Cards stack vertically
   - ✅ Step indicators show as "Step X of 4"
   - ✅ Buttons remain accessible
   - ✅ Forms are mobile-friendly

---

## Test Case 5: Route Testing ✅

### Test both routes work:
1. Go to `/claims/new`
   - ✅ Should show unified claim form
2. Go to `/allowances/new`
   - ✅ Should show SAME unified claim form
3. Try clicking "New Allowance" button in allowances list
   - ✅ Should navigate to `/allowances/new`
   - ✅ Should show unified form

---

## Test Case 6: Integration Testing ✅

### From Dashboard:
1. Go to Dashboard (/)
2. Click "New Claim" button in Quick Actions
   - ✅ Should navigate to unified form
   - ✅ Should work correctly

### From Allowances List:
1. Go to /allowances
2. Click "New Allowance" button
   - ✅ Should navigate to unified form
   - ✅ Should work correctly

---

## Test Case 7: Error Handling ✅

### Close without submitting:
1. Start filling a claim
2. Click X button (close)
   - ✅ Should return to claims list
   - ✅ No errors in console
   - ✅ Data is not saved (expected)

### Browser back button:
1. Start a claim
2. Use browser back button
   - ✅ Should return to previous page
   - ✅ No errors

---

## 🎯 Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ No TypeScript errors
- ✅ Smooth user experience
- ✅ Proper validation messages
- ✅ Correct navigation flow
- ✅ Data displays correctly
- ✅ Success messages appear

---

## 🐛 Known Issues / Notes

### Expected Behavior:
1. **Mock Data**: Submissions don't actually save (no backend yet)
2. **Success Message**: Shows toast but doesn't persist claim
3. **File Upload**: Files are tracked but not uploaded anywhere
4. **Validation**: Client-side only, backend would add more checks

### Future Enhancements:
- [ ] Save draft functionality
- [ ] Pre-fill from previous claims
- [ ] Real-time amount suggestions
- [ ] Integration with backend API

---

## 📊 Test Results Template

Use this to track your testing:

```
Date: ___________
Tester: ___________

Test Case 1: Reimbursement Flow         [ ] Pass  [ ] Fail
Test Case 2: Allowance Flow            [ ] Pass  [ ] Fail
Test Case 3: Navigation & Validation   [ ] Pass  [ ] Fail
Test Case 4: Responsive Design         [ ] Pass  [ ] Fail
Test Case 5: Route Testing             [ ] Pass  [ ] Fail
Test Case 6: Integration Testing       [ ] Pass  [ ] Fail
Test Case 7: Error Handling            [ ] Pass  [ ] Fail

Issues Found:
_________________________________
_________________________________
_________________________________

Overall Result: [ ] Ready for Production  [ ] Needs Fixes
```

---

## 🚀 Quick Test Command

```bash
# Start the app
npm run dev

# Open these URLs in sequence:
1. http://localhost:8080/claims/new
2. http://localhost:8080/allowances/new
3. http://localhost:8080/dashboard

# Both claim routes should show the same unified interface!
```

---

## ✅ Final Checklist

Before marking as complete, verify:

- [ ] App runs without errors (`npm run dev`)
- [ ] Can submit reimbursement claim
- [ ] Can submit allowance claim
- [ ] Back button works
- [ ] Validation prevents empty submissions
- [ ] Success messages appear
- [ ] Both routes work (/claims/new and /allowances/new)
- [ ] Mobile responsive
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Documentation updated

---

## 🎉 All Tests Pass?

**Congratulations!** The unified claim submission feature is working perfectly! 🚀

Report any issues or edge cases you find during testing.

