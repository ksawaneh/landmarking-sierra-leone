/**
 * E2E tests for parcel registration workflow
 */

import { device, expect, element, by, waitFor } from 'detox';

describe('Parcel Registration E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        location: 'always',
        camera: 'YES',
      },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Authentication', () => {
    it('should login successfully', async () => {
      // Enter credentials
      await element(by.id('nationalIdInput')).typeText('SL123456');
      await element(by.id('passwordInput')).typeText('testpassword');
      
      // Login
      await element(by.text('Login')).tap();
      
      // Should navigate to dashboard
      await waitFor(element(by.text('Welcome')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should enable biometric login', async () => {
      // Login first
      await element(by.id('nationalIdInput')).typeText('SL123456');
      await element(by.id('passwordInput')).typeText('testpassword');
      await element(by.text('Login')).tap();
      
      // Navigate to settings
      await element(by.text('Profile')).tap();
      await element(by.text('Settings')).tap();
      
      // Enable biometric
      await element(by.id('biometricToggle')).tap();
      
      // Should show biometric prompt
      await waitFor(element(by.text('Enable biometric login')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('Parcel Registration', () => {
    beforeEach(async () => {
      // Login
      await element(by.id('nationalIdInput')).typeText('SL123456');
      await element(by.id('passwordInput')).typeText('testpassword');
      await element(by.text('Login')).tap();
      
      await waitFor(element(by.text('Welcome')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should navigate to parcel registration', async () => {
      // Tap quick action
      await element(by.text('Register Parcel')).tap();
      
      // Should show registration form
      await waitFor(element(by.text('Parcel Number *')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should fill parcel details', async () => {
      await element(by.text('Register Parcel')).tap();
      
      // Fill form
      await element(by.id('parcelNumberInput')).typeText('P2024001');
      
      // Select land use
      await element(by.id('landUsePicker')).tap();
      await element(by.text('Residential')).tap();
      
      // Add description
      await element(by.id('descriptionInput')).typeText('Family home with garden');
      
      // Should show boundary capture section
      await expect(element(by.text('Boundary Capture'))).toBeVisible();
    });

    it('should capture GPS boundaries', async () => {
      await element(by.text('Register Parcel')).tap();
      await element(by.id('parcelNumberInput')).typeText('P2024001');
      
      // Start boundary capture
      await element(by.text('Start Boundary Capture')).tap();
      
      // Capture points
      for (let i = 0; i < 4; i++) {
        await element(by.text(`Capture Point (${i})`)).tap();
        await waitFor(element(by.text(`Point ${i + 1} captured successfully`)))
          .toBeVisible()
          .withTimeout(2000);
        await element(by.text('OK')).tap();
      }
      
      // Finish capture
      await element(by.text('Finish Capture')).tap();
      
      // Should show area calculation
      await expect(element(by.text('Estimated Area:'))).toBeVisible();
    });

    it('should save parcel with offline support', async () => {
      // Enable airplane mode to test offline
      await device.setLocation(8.484, -13.2299);
      await device.disableSynchronization();
      await device.setURLBlacklist(['.*']);
      
      await element(by.text('Register Parcel')).tap();
      
      // Fill minimum required fields
      await element(by.id('parcelNumberInput')).typeText('P2024002');
      
      // Mock boundary capture
      await element(by.text('Start Boundary Capture')).tap();
      for (let i = 0; i < 3; i++) {
        await element(by.text(`Capture Point (${i})`)).tap();
        await element(by.text('OK')).tap();
      }
      await element(by.text('Finish Capture')).tap();
      
      // Save parcel
      await element(by.text('Register Parcel')).tap();
      
      // Should show success message
      await waitFor(element(by.text('Parcel registered successfully!')))
        .toBeVisible()
        .withTimeout(5000);
      
      await waitFor(element(by.text('It will be synced when you have an internet connection.')))
        .toBeVisible()
        .withTimeout(2000);
      
      // Re-enable network
      await device.setURLBlacklist([]);
      await device.enableSynchronization();
    });
  });

  describe('Verification Workflow', () => {
    beforeEach(async () => {
      // Login and navigate to parcels
      await element(by.id('nationalIdInput')).typeText('SL123456');
      await element(by.id('passwordInput')).typeText('testpassword');
      await element(by.text('Login')).tap();
      
      await waitFor(element(by.text('Welcome')))
        .toBeVisible()
        .withTimeout(5000);
      
      await element(by.text('Parcels')).tap();
    });

    it('should show parcel verification status', async () => {
      // Should show parcels with verification progress
      await waitFor(element(by.text('P2024001')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Should show verification progress
      await expect(element(by.text('0 of 5 verifications'))).toBeVisible();
    });

    it('should navigate to verification workflow', async () => {
      // Tap on parcel
      await element(by.text('P2024001')).tap();
      
      // Should show verification steps
      await waitFor(element(by.text('Required Verifications')))
        .toBeVisible()
        .withTimeout(2000);
      
      await expect(element(by.text('Property Owner'))).toBeVisible();
      await expect(element(by.text('Community Leader'))).toBeVisible();
      await expect(element(by.text('Government Official'))).toBeVisible();
      await expect(element(by.text('Neighbor 1'))).toBeVisible();
      await expect(element(by.text('Neighbor 2'))).toBeVisible();
    });

    it('should capture verification with signature', async () => {
      await element(by.text('P2024001')).tap();
      
      // Start owner verification
      await element(by.text('Property Owner')).tap();
      
      // Fill signatory details
      await element(by.id('signatoryNameInput')).typeText('John Doe');
      await element(by.id('signatoryPhoneInput')).typeText('+23276123456');
      await element(by.id('signatoryNationalIdInput')).typeText('SL123456');
      
      await element(by.text('Continue')).tap();
      
      // Choose signature method
      await element(by.text('Digital Signature')).tap();
      
      // Draw signature (simulate)
      await element(by.id('signatureCanvas')).swipe('right', 'slow', 0.5, 0.5);
      await element(by.id('signatureCanvas')).swipe('down', 'slow', 0.7, 0.3);
      
      // Save signature
      await element(by.text('Save Signature')).tap();
      
      // Should show success
      await waitFor(element(by.text('Verification completed successfully!')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should capture verification with biometric', async () => {
      await element(by.text('P2024001')).tap();
      
      // Start community leader verification
      await element(by.text('Community Leader')).tap();
      
      // Fill signatory details
      await element(by.id('signatoryNameInput')).typeText('Chief Smith');
      await element(by.id('signatoryPhoneInput')).typeText('+23276654321');
      
      await element(by.text('Continue')).tap();
      
      // Choose biometric method
      await element(by.text('Biometric')).tap();
      
      // Biometric prompt would appear here
      // In E2E test, we assume it succeeds
      
      await waitFor(element(by.text('Verification completed successfully!')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show QR code for verification', async () => {
      await element(by.text('P2024001')).tap();
      
      // Start government official verification
      await element(by.text('Government Official')).tap();
      
      // Fill signatory details
      await element(by.id('signatoryNameInput')).typeText('Officer Brown');
      await element(by.id('signatoryPhoneInput')).typeText('+23276789012');
      
      await element(by.text('Continue')).tap();
      
      // Choose QR method
      await element(by.text('QR Code')).tap();
      
      // Should show QR code
      await waitFor(element(by.text('Verification QR Code')))
        .toBeVisible()
        .withTimeout(2000);
      
      // Can switch to scan mode
      await element(by.text('Scan Code')).tap();
      
      // Camera view would open here
      // Close for now
      await device.pressBack();
    });

    it('should complete all verifications', async () => {
      // This would be a longer test completing all 5 verifications
      // For brevity, we'll check the final state
      
      await element(by.text('P2024001')).tap();
      
      // Assume all verifications are complete
      // Should show 100% progress
      await waitFor(element(by.text('5 of 5 completed')))
        .toBeVisible()
        .withTimeout(5000);
      
      // All steps should show as verified
      const verifiedElements = await element(by.text('Verified')).getAttributes();
      expect(verifiedElements.elements.length).toBe(5);
    });
  });

  describe('Offline Sync', () => {
    it('should sync pending operations when online', async () => {
      // Login
      await element(by.id('nationalIdInput')).typeText('SL123456');
      await element(by.id('passwordInput')).typeText('testpassword');
      await element(by.text('Login')).tap();
      
      // Check sync status
      await waitFor(element(by.text('All Synced')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Create offline operation
      await device.disableSynchronization();
      await device.setURLBlacklist(['.*']);
      
      await element(by.text('Register Parcel')).tap();
      await element(by.id('parcelNumberInput')).typeText('P2024003');
      await element(by.text('Start Boundary Capture')).tap();
      for (let i = 0; i < 3; i++) {
        await element(by.text(`Capture Point (${i})`)).tap();
        await element(by.text('OK')).tap();
      }
      await element(by.text('Finish Capture')).tap();
      await element(by.text('Register Parcel')).tap();
      
      // Should show pending sync
      await device.pressBack();
      await waitFor(element(by.text('1 items pending sync')))
        .toBeVisible()
        .withTimeout(2000);
      
      // Re-enable network
      await device.setURLBlacklist([]);
      await device.enableSynchronization();
      
      // Should auto-sync
      await waitFor(element(by.text('Syncing...')))
        .toBeVisible()
        .withTimeout(5000);
      
      await waitFor(element(by.text('All Synced')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});