import { test, expect } from '@playwright/test';

test.describe('Calendar Page n2n Tests', () => {
  // We'll mock the Supabase API to avoid needing a real database state for the tests
  test.beforeEach(async ({ page }) => {
    // Mock user session
    await page.route('**/auth/v1/user', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: 'owner-id', user_metadata: { username: 'testuser' } })
      });
    });

    // Mock calendar data
    await page.route('**/rest/v1/calendars?select=*&slug=eq.test-cal*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([{ 
          id: 'cal-id', 
          user_id: 'owner-id', 
          name: 'Test Calendar', 
          slug: 'test-cal',
          availability: {
            offDays: [0, 6], // Weekends off
            hours: [
              { type: 'best', start: '09:00', end: '11:00', reason: 'Focus time' }
            ]
          }
        }])
      });
    });

    // Mock profiles
    await page.route('**/rest/v1/profiles?select=*&id=eq.owner-id*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([{ id: 'owner-id', username: 'testuser' }])
      });
    });

    // Mock calendar_access
    await page.route('**/rest/v1/calendar_access?select=username&calendar_id=eq.cal-id*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([])
      });
    });
  });

  test('should display calendar grid and appointments section', async ({ page }) => {
    await page.goto('http://localhost:5173/calendar/test-cal');

    // Wait for the calendar name to appear
    await expect(page.locator('h2.profile-name')).toContainText('Test Calendar');

    // Calendar grid should be visible
    await expect(page.locator('.calendar-grid-container')).toBeVisible();

    // The days of the week should be visible
    await expect(page.locator('text=Sun')).toBeVisible();
    await expect(page.locator('text=Mon')).toBeVisible();

    // Appointments section should be visible
    await expect(page.locator('h3', { hasText: 'Appointments on' })).toBeVisible();
    await expect(page.locator('text=No appointments scheduled for this day.')).toBeVisible();
  });

  test('owner can open the Availability Modal', async ({ page }) => {
    await page.goto('http://localhost:5173/calendar/test-cal');

    // Wait for the button and click it
    const setAvailabilityBtn = page.locator('button', { hasText: 'Set Availability' });
    await expect(setAvailabilityBtn).toBeVisible();
    await setAvailabilityBtn.click();

    // Verify modal appears
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText('Set Calendar Availability');

    // Check that pre-existing availability data is populated
    await expect(page.locator('text=Focus time')).toBeVisible();
    
    // Close modal
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(modal).not.toBeVisible();
  });
});
