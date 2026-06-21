# Unified Modal/Popup System Documentation

## Overview
The application now uses a consistent, modern modal/dialog system that replaces all old `window.alert()` and `window.confirm()` browser popups with beautiful, custom-styled modals matching the new vibrant theme.

## Components Created

### 1. **AlertModal.js**
- Displays informational, success, warning, and error messages
- Features color-coded icons based on message type
- Location: `src/components/AlertModal.js`

### 2. **ConfirmModal.js**
- Asks users to confirm or cancel an action
- Supports dangerous actions with red accent color
- Has configurable confirm/cancel text
- Location: `src/components/ConfirmModal.js`

### 3. **ModalContext.js**
- Global context provider for managing modals
- Provides two hooks: `showAlert()` and `showConfirm()`
- Location: `src/context/ModalContext.js`

## Usage

### Setup
The `ModalProvider` is already wrapped around your application in `App.js`:

```jsx
<ModalProvider>
  <AppRoutes />
</ModalProvider>
```

### Using the Modal System

#### Show an Alert
```jsx
import { useModal } from '../context/ModalContext';

function MyComponent() {
  const { showAlert } = useModal();

  const handleClick = () => {
    showAlert('Operation completed successfully!', 'Success', 'success');
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

#### Show a Confirmation
```jsx
import { useModal } from '../context/ModalContext';

function MyComponent() {
  const { showConfirm } = useModal();

  const handleDelete = async () => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this item?',
      null,
      'Confirm Deletion',
      true // isDangerous - makes button red
    );

    if (confirmed) {
      // Perform delete action
      await deleteItem();
    }
  };

  return <button onClick={handleDelete}>Delete</button>;
}
```

## API Reference

### `showAlert(message, title, type)`
**Parameters:**
- `message` (string): The message to display
- `title` (string, optional): The dialog title (defaults to 'Information')
- `type` (string, optional): One of `'info'`, `'success'`, `'warning'`, `'error'` (defaults to 'info')

**Example:**
```jsx
showAlert('An error occurred', 'Error', 'error');
```

### `showConfirm(message, onConfirm, title, isDangerous)`
**Parameters:**
- `message` (string): The confirmation message
- `onConfirm` (function, optional): Callback when user confirms
- `title` (string, optional): The dialog title (defaults to 'Confirmation')
- `isDangerous` (boolean, optional): If true, button appears red (defaults to false)

**Returns:** Promise that resolves to `true` if confirmed, `false` if cancelled

**Example:**
```jsx
const confirmed = await showConfirm(
  'Delete this record?',
  null,
  'Delete Record',
  true
);
```

## Pages Updated

The following pages have been updated to use the new modal system:

✅ TransactionsOutgoing.js
✅ TousLesRetraits.js
✅ Profile.js
✅ Notifications.js
✅ MesEntites.js
✅ GestionListes.js
✅ Dashboard.js
✅ GestionCourriers.js
✅ GererUtilisateurs.js
✅ GererServices.js
✅ GererEquipements.js
✅ GererArchivesJuridiques.js

## Styling

All modals use the existing CSS classes from `theme.css`:
- `.modal-overlay` - Semi-transparent dark background
- `.modal` - The modal dialog box
- `.registry-panel-header` - Header section
- `.form-actions` - Action buttons

The modals automatically match the new vibrant color scheme with clear, readable text and buttons.

## Benefits

✨ **Consistent UX** - All dialogs look and behave the same way
✨ **Accessible** - Proper keyboard support and focus management
✨ **Themeable** - Matches the application's new vibrant color scheme
✨ **Non-blocking** - Modals are performant and don't block rendering
✨ **Easy to Use** - Simple, promise-based API
✨ **Professional** - Modern, polished appearance

## Migration Notes

- All `window.alert()` calls replaced with `showAlert()`
- All `window.confirm()` calls replaced with `showConfirm()`
- No breaking changes to existing functionality
- All modal styling is controlled by theme.css
