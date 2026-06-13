# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the mobile experience for iPhone Safari to feel intentional and clean with proper spacing, readable text, touch-friendly tap targets, and no horizontal overflow.

**Architecture:** CSS-first approach using Tailwind responsive prefixes (md: breakpoint at 768px). Modify existing components rather than creating new ones. Focus on mobile-first styles that enhance the existing responsive foundations.

**Tech Stack:** React, Tailwind CSS, existing mobile utilities in index.css

---

## Task 1: Navigation & Sidebar Mobile Polish

**Files:**
- Modify: `client/src/components/layout/Sidebar.jsx`
- Modify: `client/src/components/layout/AppLayout.jsx`

- [ ] **Step 1: Increase Sidebar close button tap target**

In `Sidebar.jsx` line 71-76, update the close button to have 44x44px minimum tap target:

```jsx
<button
  onClick={onClose}
  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
>
  <X size={20} />
</button>
```

- [ ] **Step 2: Increase nav item tap targets**

In `Sidebar.jsx` line 94-107, update NavLink to have 44px minimum height:

```jsx
<NavLink
  to={item.path}
  onClick={handleNavClick}
  className={({ isActive }) =>
    `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors min-h-[44px] touch-manipulation ${
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`
  }
>
```

- [ ] **Step 3: Increase logout button tap target**

In `Sidebar.jsx` line 133-139, update logout button:

```jsx
<button
  onClick={logout}
  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
  title="Logout"
>
  <LogOut size={18} />
</button>
```

- [ ] **Step 4: Increase bottom nav tap targets in AppLayout**

In `AppLayout.jsx` line 171-184, update the button to have explicit 44px minimum height:

```jsx
<button
  key={item.label}
  onClick={() => handleBottomNavClick(item)}
  className={`flex flex-col items-center justify-center flex-1 min-h-[56px] touch-manipulation ${
    item.highlight
      ? 'text-accent'
      : isActive
      ? 'text-primary'
      : 'text-gray-500'
  }`}
>
  <Icon size={item.highlight ? 24 : 20} />
  <span className="text-xs mt-0.5">{item.label}</span>
</button>
```

- [ ] **Step 5: Verify changes**

Run: `npm run dev` in client directory and test on iPhone Safari or Chrome DevTools mobile emulation. Verify all navigation items are easily tappable.

---

## Task 2: Contact & Company List Mobile Views

**Files:**
- Modify: `client/src/pages/contacts/ContactListPage.jsx`
- Modify: `client/src/pages/companies/CompanyListPage.jsx`

- [ ] **Step 1: Add mobile card view to ContactListPage**

Replace the table section (lines 223-283) with responsive desktop table + mobile cards:

```jsx
{/* Desktop Table View */}
<div className="hidden md:block">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets</th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {contactList.map((contact) => (
        <tr key={contact.id} className="hover:bg-gray-50">
          <td className="px-6 py-4">
            <Link to={'/contacts/' + contact.id} className="flex items-center gap-3">
              <Avatar name={contact.name} size="sm" />
              <div>
                <p className="text-sm font-medium text-gray-900 hover:text-primary">{contact.name}</p>
                <p className="text-sm text-gray-500">{contact.email}</p>
              </div>
            </Link>
          </td>
          <td className="px-6 py-4">
            {contact.company ? (
              <Link to={'/companies/' + contact.company.id} className="flex items-center gap-2 text-sm text-gray-900 hover:text-primary">
                <Building2 size={16} className="text-gray-400" />
                {contact.company.name}
              </Link>
            ) : <span className="text-sm text-gray-400">-</span>}
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">{contact.phone || '-'}</td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Ticket size={16} />
              {contact._count?.tickets || 0}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleEditClick(contact)}
                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                title="Edit contact"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleDeleteClick(contact)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete contact"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Mobile Card View */}
<div className="md:hidden divide-y divide-gray-200">
  {contactList.map((contact) => (
    <div key={contact.id} className="p-4 active:bg-gray-50 touch-manipulation">
      <Link to={'/contacts/' + contact.id} className="flex items-start gap-3">
        <Avatar name={contact.name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{contact.name}</p>
          <p className="text-sm text-gray-500 truncate">{contact.email}</p>
          {contact.company && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {contact.company.name}
            </p>
          )}
        </div>
      </Link>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {contact.phone && <span>{contact.phone}</span>}
          <span className="flex items-center gap-1">
            <Ticket size={12} />
            {contact._count?.tickets || 0} tickets
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.preventDefault(); handleEditClick(contact); }}
            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); handleDeleteClick(contact); }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 2: Make ContactListPage header responsive**

Update lines 197-205 header section:

```jsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
  <div>
    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Contacts</h1>
    <p className="text-sm text-gray-500 mt-0.5">{pagination.total} total contacts</p>
  </div>
  <Button leftIcon={<Plus size={18} />} onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
    Add Contact
  </Button>
</div>
```

- [ ] **Step 3: Make ContactListPage search full-width on mobile**

Update lines 207-214 search section:

```jsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 mb-4 md:mb-6">
  <SearchInput
    value={filters.search}
    onChange={(value) => updateFilters({ search: value, page: 1 })}
    placeholder="Search contacts..."
    className="w-full md:w-64"
  />
</div>
```

- [ ] **Step 4: Add mobile card view to CompanyListPage**

Apply same pattern to CompanyListPage - replace table (lines 173-236) with responsive desktop table + mobile cards:

```jsx
{/* Desktop Table View */}
<div className="hidden md:block">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Manager</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacts</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets</th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {companyList.map((company) => (
        <tr key={company.id} className="hover:bg-gray-50">
          <td className="px-6 py-4">
            <Link to={'/companies/' + company.id} className="text-sm font-medium text-gray-900 hover:text-primary">
              {company.name}
            </Link>
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">{company.domain || '-'}</td>
          <td className="px-6 py-4">
            {company.assignedAgent ? (
              <div className="flex items-center gap-2">
                <Avatar name={company.assignedAgent.name} size="xs" />
                <span className="text-sm text-gray-900">{company.assignedAgent.name}</span>
              </div>
            ) : <span className="text-sm text-gray-400">-</span>}
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users size={16} />
              {company._count?.contacts || 0}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Ticket size={16} />
              {company._count?.tickets || 0}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleEditClick(company)}
                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                title="Edit company"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleDeleteClick(company)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete company"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Mobile Card View */}
<div className="md:hidden divide-y divide-gray-200">
  {companyList.map((company) => (
    <div key={company.id} className="p-4 active:bg-gray-50 touch-manipulation">
      <Link to={'/companies/' + company.id}>
        <p className="text-sm font-medium text-gray-900">{company.name}</p>
        {company.domain && <p className="text-xs text-gray-500 mt-0.5">{company.domain}</p>}
      </Link>
      {company.assignedAgent && (
        <div className="flex items-center gap-2 mt-2">
          <Avatar name={company.assignedAgent.name} size="xs" />
          <span className="text-xs text-gray-600">{company.assignedAgent.name}</span>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {company._count?.contacts || 0} contacts
          </span>
          <span className="flex items-center gap-1">
            <Ticket size={12} />
            {company._count?.tickets || 0} tickets
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.preventDefault(); handleEditClick(company); }}
            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); handleDeleteClick(company); }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 5: Make CompanyListPage header responsive**

Update lines 147-155:

```jsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
  <div>
    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Companies</h1>
    <p className="text-sm text-gray-500 mt-0.5">{pagination.total} total companies</p>
  </div>
  <Button leftIcon={<Plus size={18} />} onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
    Add Company
  </Button>
</div>
```

- [ ] **Step 6: Make CompanyListPage search full-width on mobile**

Update lines 157-164:

```jsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 mb-4 md:mb-6">
  <SearchInput
    value={filters.search}
    onChange={(value) => updateFilters({ search: value, page: 1 })}
    placeholder="Search companies..."
    className="w-full md:w-64"
  />
</div>
```

- [ ] **Step 7: Verify changes**

Test both Contact and Company list pages on mobile emulation. Verify cards display correctly and edit/delete buttons are easily tappable.

---

## Task 3: Calendar Mobile Optimization

**Files:**
- Modify: `client/src/pages/CalendarPage.jsx`

- [ ] **Step 1: Add mobile header with view toggle**

Find the header section and update to be responsive (around line 700-750 area, in the return statement):

```jsx
{/* Header - responsive */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
  <div className="flex items-center gap-2 md:gap-4">
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate_date(-1)}
        className="p-2 hover:bg-gray-100 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => navigate_date(1)}
        className="p-2 hover:bg-gray-100 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation"
      >
        <ChevronRight size={20} />
      </button>
    </div>
    <h1 className="text-lg md:text-xl font-bold text-gray-900">{formatDateHeader()}</h1>
    <button
      onClick={goToToday}
      className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg min-h-[36px] touch-manipulation"
    >
      Today
    </button>
  </div>

  {/* View toggle - horizontal scroll on mobile */}
  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
    {[
      { key: 'month', label: 'Month', icon: Grid3X3 },
      { key: 'week', label: 'Week', icon: CalendarIcon },
      { key: 'day', label: 'Day', icon: List },
    ].map(({ key, label, icon: Icon }) => (
      <button
        key={key}
        onClick={() => setView(key)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] touch-manipulation whitespace-nowrap ${
          view === key
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <Icon size={16} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Add overflow handling to week view time grid**

In renderWeekView function, wrap the time grid with proper overflow handling:

```jsx
{/* Week view container - horizontal scroll on mobile */}
<div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
  <div className="min-w-[700px] md:min-w-0">
    {/* existing week view content */}
  </div>
</div>
```

- [ ] **Step 3: Make unscheduled sidebar collapsible on mobile**

The unscheduled tickets sidebar should use a bottom sheet on mobile. Update the toggle button and sidebar rendering:

```jsx
{/* Unscheduled sidebar toggle - fixed on mobile */}
<button
  onClick={() => setShowUnscheduledSidebar(!showUnscheduledSidebar)}
  className="fixed bottom-20 right-4 md:static md:bottom-auto md:right-auto z-20 p-3 bg-white shadow-lg rounded-full md:rounded-lg md:shadow-sm md:border md:border-gray-200 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation"
>
  <ListTodo size={20} />
</button>

{/* Mobile: Bottom sheet, Desktop: Side panel */}
{showUnscheduledSidebar && (
  <>
    {/* Mobile backdrop */}
    <div
      className="md:hidden fixed inset-0 bg-black/50 z-40"
      onClick={() => setShowUnscheduledSidebar(false)}
    />
    {/* Sidebar content */}
    <div className="fixed inset-x-0 bottom-0 md:static md:inset-auto md:w-72 bg-white rounded-t-2xl md:rounded-lg shadow-lg md:shadow-sm md:border md:border-gray-200 z-50 max-h-[70vh] md:max-h-none overflow-hidden flex flex-col">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Unscheduled Tickets</h3>
        <button
          onClick={() => setShowUnscheduledSidebar(false)}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
        >
          <X size={20} />
        </button>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* existing unscheduled tickets list */}
      </div>
    </div>
  </>
)}
```

- [ ] **Step 4: Improve month view cell tap targets**

In renderMonthView, make day cells more tappable:

```jsx
<div
  key={idx}
  onClick={() => handleDayClick(date)}
  className={`bg-white p-2 min-h-[70px] md:min-h-[100px] cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${
    !isCurrentMonth ? 'opacity-50' : ''
  }`}
  title="Click to view day schedule"
>
```

- [ ] **Step 5: Verify calendar changes**

Test month, week, and day views on mobile. Verify:
- No horizontal overflow on month view
- Week view scrolls horizontally gracefully
- Day cells are easily tappable
- Unscheduled sidebar works as bottom sheet on mobile

---

## Task 4: Form Mobile Optimization

**Files:**
- Modify: `client/src/components/shared/Input.jsx`
- Modify: `client/src/components/shared/Select.jsx`
- Modify: `client/src/components/shared/Textarea.jsx`
- Modify: `client/src/components/shared/Button.jsx`

- [ ] **Step 1: Ensure Input has 16px font and 44px height**

Check Input.jsx and ensure these classes are present:

```jsx
className={`w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] ${className}`}
```

Note: `text-base` is 16px which prevents iOS zoom on focus.

- [ ] **Step 2: Ensure Select has 16px font and 44px height**

Check Select.jsx and ensure:

```jsx
className={`w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] appearance-none bg-white ${className}`}
```

- [ ] **Step 3: Ensure Textarea has 16px font**

Check Textarea.jsx and ensure:

```jsx
className={`w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none ${className}`}
```

- [ ] **Step 4: Ensure Button has proper mobile sizing**

Check Button.jsx and ensure minimum sizes:

```jsx
// For size="md" (default)
className={`... min-h-[44px] touch-manipulation ...`}

// For size="lg"
className={`... min-h-[48px] touch-manipulation ...`}
```

- [ ] **Step 5: Verify form inputs**

Test NewTicketPage, Contact modal, and Company modal on mobile. Verify inputs don't trigger iOS zoom and buttons are easily tappable.

---

## Task 5: Ticket Detail Mobile Polish

**Files:**
- Modify: `client/src/pages/tickets/TicketDetailPage.jsx`

- [ ] **Step 1: Make reply form buttons full-width on mobile**

Around line 1228-1237, update the button section:

```jsx
<div className="flex flex-col sm:flex-row justify-between gap-3 mt-3">
  {isInternalNote && (
    <Button
      variant="outline"
      onClick={parseNote}
      disabled={!replyContent.trim()}
      leftIcon={<Zap size={16} />}
      className="w-full sm:w-auto"
    >
      Parse & Log
    </Button>
  )}
  <div className={`${!isInternalNote ? 'w-full sm:ml-auto sm:w-auto' : 'w-full sm:w-auto'}`}>
    <Button
      onClick={handleSendReply}
      isLoading={replyMutation.isPending}
      disabled={!replyContent.trim()}
      leftIcon={<Send size={16} />}
      className="w-full sm:w-auto"
    >
      {isInternalNote ? 'Add Note' : 'Send Reply'}
    </Button>
  </div>
</div>
```

- [ ] **Step 2: Improve time log inputs for mobile**

Around lines 1088-1186, ensure time inputs have proper mobile sizing:

```jsx
<input
  type="date"
  value={timeLogDate}
  onChange={(e) => setTimeLogDate(e.target.value)}
  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
/>
```

And for time inputs:

```jsx
<input
  type="time"
  value={timeLogStartTime}
  onChange={(e) => setTimeLogStartTime(e.target.value)}
  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
/>
```

- [ ] **Step 3: Improve modal button layout on mobile**

For all modals (KB, Template, Forward, Edit), update button sections to stack on mobile:

```jsx
<div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
  <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
    Cancel
  </Button>
  <Button onClick={onConfirm} className="w-full sm:w-auto">
    Confirm
  </Button>
</div>
```

- [ ] **Step 4: Verify ticket detail page**

Test ticket detail page on mobile. Verify:
- Reply form buttons are full width on mobile
- Time inputs don't trigger zoom
- Modals have proper button stacking

---

## Task 6: Global Mobile Cleanup

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/src/components/shared/Modal.jsx`
- Modify: `client/src/components/shared/Pagination.jsx`

- [ ] **Step 1: Add overflow-x hidden to body for safety**

In index.css, add to the base layer or body styles:

```css
@layer base {
  html, body {
    @apply overflow-x-hidden;
  }
}
```

- [ ] **Step 2: Ensure Modal is full-screen on mobile**

Check Modal.jsx and ensure it uses the modal-mobile class or equivalent:

```jsx
<div className={`fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full bg-white rounded-2xl md:rounded-lg shadow-xl z-50 flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden`}>
```

- [ ] **Step 3: Make Pagination touch-friendly**

Check Pagination.jsx and ensure buttons have proper sizing:

```jsx
<button className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation ...">
```

- [ ] **Step 4: Final verification**

Test all pages on iPhone Safari or Chrome DevTools mobile emulation:
- [ ] Navigation/Sidebar - tap targets work
- [ ] Ticket List - cards readable, filters work
- [ ] Ticket Detail - reply form usable, modals work
- [ ] Calendar - views work, no horizontal overflow
- [ ] Contacts - cards work, modals work
- [ ] Companies - cards work, modals work
- [ ] Forms - no zoom on focus, buttons full width

---

## Files Modified Summary

After completing all tasks, the following files will have been modified:

1. `client/src/components/layout/Sidebar.jsx` - Increased tap targets
2. `client/src/components/layout/AppLayout.jsx` - Improved bottom nav
3. `client/src/pages/contacts/ContactListPage.jsx` - Added mobile card view
4. `client/src/pages/companies/CompanyListPage.jsx` - Added mobile card view
5. `client/src/pages/CalendarPage.jsx` - Mobile header, overflow handling, sidebar
6. `client/src/components/shared/Input.jsx` - 16px font, 44px height
7. `client/src/components/shared/Select.jsx` - 16px font, 44px height
8. `client/src/components/shared/Textarea.jsx` - 16px font
9. `client/src/components/shared/Button.jsx` - Minimum touch sizes
10. `client/src/pages/tickets/TicketDetailPage.jsx` - Full-width buttons, input sizing
11. `client/src/index.css` - Overflow-x hidden
12. `client/src/components/shared/Modal.jsx` - Full-screen mobile
13. `client/src/components/shared/Pagination.jsx` - Touch-friendly buttons
