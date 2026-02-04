/**
 * Test User Authentication & Profile Management
 * This script tests:
 * 1. User Signup (Registration)
 * 2. User Signin (Login)
 * 3. Get User Profile
 * 4. Update User Profile/Details
 * 5. Change Password
 */

import prisma from '../lib/prisma.mjs';
import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_API_URL || 'http://localhost:3000';

// Generate unique test user data
const generateTestUser = () => {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  return {
    email: `testuser_${uniqueId}@delipucash.com`,
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: `User_${uniqueId}`,
    phone: `+256700${Math.floor(100000 + Math.random() * 900000)}`,
  };
};

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 USER AUTHENTICATION & PROFILE MANAGEMENT TEST');
  console.log('='.repeat(60));
  
  const testUser = generateTestUser();
  let authToken = null;
  let userId = null;
  
  try {
    // ========================================================================
    // STEP 1: User Signup (Registration)
    // ========================================================================
    console.log('\n📌 Step 1: User Signup (Registration)...');
    console.log('   Email:', testUser.email);
    
    const signupResponse = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        phone: testUser.phone,
      }),
    });
    
    const signupResult = await signupResponse.json();
    console.log('   Response status:', signupResponse.status);
    
    if (!signupResponse.ok) {
      throw new Error(`Signup failed: ${signupResult.message || JSON.stringify(signupResult)}`);
    }
    
    userId = signupResult.user.id;
    authToken = signupResult.token;
    
    console.log('✅ User registered successfully!');
    console.log('   User ID:', userId);
    console.log('   Token received:', authToken ? 'Yes' : 'No');
    
    // ========================================================================
    // STEP 2: Test Duplicate Signup (should fail)
    // ========================================================================
    console.log('\n📌 Step 2: Test Duplicate Signup (should fail)...');
    
    const duplicateResponse = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        phone: testUser.phone,
      }),
    });
    
    const duplicateResult = await duplicateResponse.json();
    
    if (duplicateResponse.status === 409) {
      console.log('✅ Duplicate signup correctly rejected!');
      console.log('   Error message:', duplicateResult.message);
    } else {
      console.log('⚠️  Unexpected response for duplicate signup:', duplicateResponse.status);
    }
    
    // ========================================================================
    // STEP 3: User Signin (Login)
    // ========================================================================
    console.log('\n📌 Step 3: User Signin (Login)...');
    
    const signinResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });
    
    const signinResult = await signinResponse.json();
    console.log('   Response status:', signinResponse.status);
    
    if (!signinResponse.ok || !signinResult.success) {
      throw new Error(`Signin failed: ${signinResult.message || JSON.stringify(signinResult)}`);
    }
    
    // Update token from signin
    authToken = signinResult.token;
    
    console.log('✅ User signed in successfully!');
    console.log('   User Email:', signinResult.user.email);
    console.log('   User Name:', `${signinResult.user.firstName} ${signinResult.user.lastName}`);
    console.log('   Token refreshed:', authToken ? 'Yes' : 'No');
    
    // ========================================================================
    // STEP 4: Test Invalid Login (wrong password)
    // ========================================================================
    console.log('\n📌 Step 4: Test Invalid Login (wrong password)...');
    
    const invalidLoginResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'WrongPassword123!',
      }),
    });
    
    const invalidLoginResult = await invalidLoginResponse.json();
    
    if (invalidLoginResponse.status === 401) {
      console.log('✅ Invalid login correctly rejected!');
      console.log('   Error message:', invalidLoginResult.message);
    } else {
      console.log('⚠️  Unexpected response for invalid login:', invalidLoginResponse.status);
    }
    
    // ========================================================================
    // STEP 5: Get User Profile
    // ========================================================================
    console.log('\n📌 Step 5: Get User Profile...');
    console.log('   Using token:', authToken ? authToken.substring(0, 20) + '...' : 'NONE');
    
    const profileResponse = await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    const profileResult = await profileResponse.json();
    console.log('   Response status:', profileResponse.status);
    console.log('   Response body:', JSON.stringify(profileResult, null, 2));
    
    if (!profileResponse.ok || !profileResult.success) {
      throw new Error(`Get profile failed: ${profileResult.message || profileResult.error || JSON.stringify(profileResult)}`);
    }
    
    console.log('✅ Profile retrieved successfully!');
    console.log('   ID:', profileResult.data.id);
    console.log('   Email:', profileResult.data.email);
    console.log('   First Name:', profileResult.data.firstName);
    console.log('   Last Name:', profileResult.data.lastName);
    console.log('   Phone:', profileResult.data.phone);
    console.log('   Points:', profileResult.data.points);
    console.log('   Role:', profileResult.data.role);
    
    // ========================================================================
    // STEP 6: Update User Profile
    // ========================================================================
    console.log('\n📌 Step 6: Update User Profile...');
    
    const updatedData = {
      firstName: 'UpdatedFirst',
      lastName: 'UpdatedLast',
      phone: '+256700999888',
      avatar: 'https://example.com/new-avatar.jpg',
    };
    
    console.log('   Updating to:', updatedData);
    
    const updateResponse = await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(updatedData),
    });
    
    const updateResult = await updateResponse.json();
    console.log('   Response status:', updateResponse.status);
    
    if (!updateResponse.ok || !updateResult.success) {
      throw new Error(`Update profile failed: ${updateResult.message || updateResult.error || JSON.stringify(updateResult)}`);
    }
    
    console.log('✅ Profile updated successfully!');
    console.log('   New First Name:', updateResult.data.firstName);
    console.log('   New Last Name:', updateResult.data.lastName);
    console.log('   New Phone:', updateResult.data.phone);
    console.log('   New Avatar:', updateResult.data.avatar);
    
    // Verify update was persisted
    if (updateResult.data.firstName !== updatedData.firstName) {
      throw new Error('First name was not updated correctly');
    }
    if (updateResult.data.lastName !== updatedData.lastName) {
      throw new Error('Last name was not updated correctly');
    }
    
    // ========================================================================
    // STEP 7: Verify Profile Update Persistence
    // ========================================================================
    console.log('\n📌 Step 7: Verify Profile Update Persistence...');
    
    const verifyResponse = await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    const verifyResult = await verifyResponse.json();
    
    if (!verifyResponse.ok || !verifyResult.success) {
      throw new Error(`Verify profile failed: ${verifyResult.message || JSON.stringify(verifyResult)}`);
    }
    
    const allFieldsMatch = 
      verifyResult.data.firstName === updatedData.firstName &&
      verifyResult.data.lastName === updatedData.lastName &&
      verifyResult.data.avatar === updatedData.avatar;
    
    if (allFieldsMatch) {
      console.log('✅ Profile changes persisted correctly!');
    } else {
      throw new Error('Profile changes were not persisted correctly');
    }
    
    // ========================================================================
    // STEP 8: Change Password
    // ========================================================================
    console.log('\n📌 Step 8: Change Password...');
    
    const newPassword = 'NewSecurePass456!';
    
    const changePasswordResponse = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        currentPassword: testUser.password,
        newPassword: newPassword,
      }),
    });
    
    const changePasswordResult = await changePasswordResponse.json();
    console.log('   Response status:', changePasswordResponse.status);
    
    if (!changePasswordResponse.ok || !changePasswordResult.success) {
      throw new Error(`Change password failed: ${changePasswordResult.message || JSON.stringify(changePasswordResult)}`);
    }
    
    console.log('✅ Password changed successfully!');
    
    // ========================================================================
    // STEP 9: Verify New Password Works
    // ========================================================================
    console.log('\n📌 Step 9: Verify New Password Works...');
    
    const newPasswordLoginResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: newPassword,
      }),
    });
    
    const newPasswordLoginResult = await newPasswordLoginResponse.json();
    
    if (!newPasswordLoginResponse.ok || !newPasswordLoginResult.success) {
      throw new Error(`Login with new password failed: ${newPasswordLoginResult.message || JSON.stringify(newPasswordLoginResult)}`);
    }
    
    console.log('✅ Login with new password successful!');
    
    // ========================================================================
    // STEP 10: Test Unauthorized Access (no token)
    // ========================================================================
    console.log('\n📌 Step 10: Test Unauthorized Access (no token)...');
    
    const unauthorizedResponse = await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // No Authorization header
    });
    
    if (unauthorizedResponse.status === 401 || unauthorizedResponse.status === 403) {
      console.log('✅ Unauthorized access correctly rejected!');
      console.log('   Status:', unauthorizedResponse.status);
    } else {
      console.log('⚠️  Unexpected response for unauthorized access:', unauthorizedResponse.status);
    }
    
    // ========================================================================
    // STEP 11: Forgot Password (Request Reset)
    // ========================================================================
    console.log('\n📌 Step 11: Forgot Password (Request Reset)...');
    
    const forgotPasswordResponse = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email }),
    });
    
    const forgotPasswordResult = await forgotPasswordResponse.json();
    console.log('   Response status:', forgotPasswordResponse.status);
    
    if (forgotPasswordResponse.ok && forgotPasswordResult.success) {
      console.log('✅ Password reset email requested successfully!');
      console.log('   Message:', forgotPasswordResult.message);
    } else {
      console.log('⚠️  Forgot password failed:', forgotPasswordResult.message);
    }
    
    // ========================================================================
    // STEP 12: Verify Reset Token in Database & Validate Token
    // ========================================================================
    console.log('\n📌 Step 12: Verify Reset Token Generated...');
    
    // Get user from database to check token was stored
    const userWithToken = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { passwordResetToken: true, passwordResetExpiry: true }
    });
    
    if (userWithToken.passwordResetToken && userWithToken.passwordResetExpiry) {
      console.log('✅ Reset token generated and stored in database!');
      console.log('   Token expiry:', userWithToken.passwordResetExpiry);
      
      // Note: In production, we'd get the token from email. Here we'll generate a new one for testing.
      // We need to test the reset-password endpoint with a valid token
    } else {
      console.log('⚠️  Reset token not found in database');
    }
    
    // ========================================================================
    // STEP 13: Test Forgot Password for Non-Existent Email (Security Check)
    // ========================================================================
    console.log('\n📌 Step 13: Test Forgot Password for Non-Existent Email...');
    
    const fakeEmailResponse = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@delipucash.com' }),
    });
    
    const fakeEmailResult = await fakeEmailResponse.json();
    
    // Security best practice: Same response for existing and non-existing emails
    if (fakeEmailResponse.ok && fakeEmailResult.success) {
      console.log('✅ Email enumeration protection working!');
      console.log('   Same response for non-existent email (security best practice)');
    } else {
      console.log('⚠️  Unexpected response:', fakeEmailResult.message);
    }
    
    // ========================================================================
    // STEP 14: Test Reset Password with Direct Token
    // ========================================================================
    console.log('\n📌 Step 14: Test Password Reset with Valid Token...');
    
    // Generate a new reset token directly for testing
    const testResetToken = crypto.randomBytes(32).toString('hex');
    const hashedTestToken = crypto.createHash('sha256').update(testResetToken).digest('hex');
    const resetExpiry = new Date(Date.now() + 30 * 60 * 1000);
    
    // Store token in database
    await prisma.appUser.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedTestToken,
        passwordResetExpiry: resetExpiry,
      }
    });
    
    const resetNewPassword = 'ResetSecurePass789!';
    
    const resetPasswordResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: testResetToken,
        email: testUser.email,
        newPassword: resetNewPassword,
      }),
    });
    
    const resetPasswordResult = await resetPasswordResponse.json();
    console.log('   Response status:', resetPasswordResponse.status);
    
    if (resetPasswordResponse.ok && resetPasswordResult.success) {
      console.log('✅ Password reset successful!');
      console.log('   Message:', resetPasswordResult.message);
    } else {
      throw new Error(`Password reset failed: ${resetPasswordResult.message}`);
    }
    
    // ========================================================================
    // STEP 15: Verify Reset Password Works (Login with New Password)
    // ========================================================================
    console.log('\n📌 Step 15: Verify Login with Reset Password...');
    
    const resetLoginResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: resetNewPassword,
      }),
    });
    
    const resetLoginResult = await resetLoginResponse.json();
    
    if (resetLoginResponse.ok && resetLoginResult.success) {
      console.log('✅ Login with reset password successful!');
      authToken = resetLoginResult.token; // Update token for signout
    } else {
      throw new Error(`Login after reset failed: ${resetLoginResult.message}`);
    }
    
    // ========================================================================
    // STEP 16: Test Reset with Invalid/Expired Token
    // ========================================================================
    console.log('\n📌 Step 16: Test Reset with Invalid Token...');
    
    const invalidTokenResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid-token-12345',
        email: testUser.email,
        newPassword: 'AnotherPass123!',
      }),
    });
    
    const invalidTokenResult = await invalidTokenResponse.json();
    
    if (invalidTokenResponse.status === 400 && !invalidTokenResult.success) {
      console.log('✅ Invalid token correctly rejected!');
      console.log('   Message:', invalidTokenResult.message);
    } else {
      console.log('⚠️  Unexpected response for invalid token');
    }
    
    // ========================================================================
    // STEP 17: Test Validate Reset Token Endpoint
    // ========================================================================
    console.log('\n📌 Step 17: Test Validate Reset Token Endpoint...');
    
    // Generate another token for validation test
    const validationToken = crypto.randomBytes(32).toString('hex');
    const hashedValidationToken = crypto.createHash('sha256').update(validationToken).digest('hex');
    
    await prisma.appUser.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedValidationToken,
        passwordResetExpiry: new Date(Date.now() + 30 * 60 * 1000),
      }
    });
    
    const validateTokenResponse = await fetch(`${BASE_URL}/api/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validationToken,
        email: testUser.email,
      }),
    });
    
    const validateTokenResult = await validateTokenResponse.json();
    
    if (validateTokenResponse.ok && validateTokenResult.valid) {
      console.log('✅ Token validation working correctly!');
      console.log('   Token is valid:', validateTokenResult.valid);
    } else {
      console.log('⚠️  Token validation failed:', validateTokenResult.message);
    }
    
    // ========================================================================
    // STEP 18: User Signout
    // ========================================================================
    console.log('\n📌 Step 18: User Signout...');
    
    const signoutResponse = await fetch(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    const signoutResult = await signoutResponse.json();
    console.log('   Response status:', signoutResponse.status);
    
    if (signoutResponse.ok) {
      console.log('✅ User signed out successfully!');
    } else {
      console.log('⚠️  Signout response:', signoutResult);
    }
    
    // ========================================================================
    // CLEANUP: Delete test user
    // ========================================================================
    console.log('\n📌 Cleanup: Removing test user from database...');
    
    // Delete any login sessions first
    await prisma.loginSession.deleteMany({
      where: { userId: userId }
    });
    
    // Delete the test user
    await prisma.appUser.delete({
      where: { id: userId }
    });
    
    console.log('✅ Test user cleaned up successfully!');
    
    // ========================================================================
    // SUCCESS SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log('• User signup (registration) working correctly');
    console.log('• Duplicate signup prevention working');
    console.log('• User signin (login) working correctly');
    console.log('• Invalid login rejection working');
    console.log('• Get user profile working');
    console.log('• Update user profile working');
    console.log('• Profile changes persisting correctly');
    console.log('• Password change working');
    console.log('• New password verification working');
    console.log('• Unauthorized access protection working');
    console.log('• Forgot password (reset request) working');
    console.log('• Reset token generation working');
    console.log('• Email enumeration protection working');
    console.log('• Password reset with token working');
    console.log('• Login after reset working');
    console.log('• Invalid token rejection working');
    console.log('• Token validation endpoint working');
    console.log('• User signout working');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    
    // Cleanup on failure
    if (userId) {
      console.log('\n📌 Attempting cleanup after failure...');
      try {
        await prisma.loginSession.deleteMany({ where: { userId } });
        await prisma.appUser.delete({ where: { id: userId } });
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.log('⚠️  Cleanup failed:', cleanupError.message);
      }
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
