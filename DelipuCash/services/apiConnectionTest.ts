/**
 * API Connection Test Utility
 * 
 * @description Tests frontend REST API connection with the server.
 * Run these tests to verify the setup is correct.
 * 
 * Usage: Import and call testApiConnection() from a component or run via Jest
 */

import { API_ROUTES } from "./api";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

interface TestSuite {
  passed: number;
  failed: number;
  results: TestResult[];
}

/**
 * Test health check endpoint
 */
export async function testHealthCheck(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();
    const duration = Date.now() - start;

    if (response.ok && data.status === "OK") {
      return {
        name: "Health Check",
        success: true,
        message: `Server is healthy (${data.environment} mode)`,
        data,
        duration,
      };
    }
    return {
      name: "Health Check",
      success: false,
      message: "Health check failed",
      data,
      duration,
    };
  } catch (error) {
    return {
      name: "Health Check",
      success: false,
      message: "Failed to connect to server",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start,
    };
  }
}

/**
 * Test login endpoint with valid credentials
 */
export async function testLogin(
  email: string,
  password: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.auth.login}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    const duration = Date.now() - start;

    if (response.ok && data.success && data.token) {
      return {
        name: "Login",
        success: true,
        message: `Login successful for ${email}`,
        data: { ...data, token: data.token.substring(0, 20) + "..." },
        duration,
      };
    }

    return {
      name: "Login",
      success: false,
      message: data.message || "Login failed",
      data,
      duration,
    };
  } catch (error) {
    return {
      name: "Login",
      success: false,
      message: "Login request failed",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start,
    };
  }
}

/**
 * Test login with invalid credentials (should fail gracefully)
 */
export async function testInvalidLogin(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.auth.login}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "invalid@example.com",
        password: "wrongpassword",
      }),
    });

    const data = await response.json();
    const duration = Date.now() - start;

    // Should return 404 for user not found or 401 for wrong password
    if (response.status === 404 || response.status === 401) {
      return {
        name: "Invalid Login (Expected Failure)",
        success: true,
        message: `Server correctly rejected invalid credentials (${response.status})`,
        data,
        duration,
      };
    }

    return {
      name: "Invalid Login (Expected Failure)",
      success: false,
      message: "Server did not properly reject invalid credentials",
      data,
      duration,
    };
  } catch (error) {
    return {
      name: "Invalid Login (Expected Failure)",
      success: false,
      message: "Request failed unexpectedly",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start,
    };
  }
}

/**
 * Test signup endpoint
 */
export async function testSignup(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.auth.register}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, firstName, lastName, phone }),
    });

    const data = await response.json();
    const duration = Date.now() - start;

    if (response.ok && data.token) {
      return {
        name: "Signup",
        success: true,
        message: `Signup successful for ${email}`,
        data: { ...data, token: data.token.substring(0, 20) + "..." },
        duration,
      };
    }

    // 409 means user already exists - this is expected for repeat tests
    if (response.status === 409) {
      return {
        name: "Signup",
        success: true,
        message: `User already exists (expected for repeat tests)`,
        data,
        duration,
      };
    }

    return {
      name: "Signup",
      success: false,
      message: data.message || "Signup failed",
      data,
      duration,
    };
  } catch (error) {
    return {
      name: "Signup",
      success: false,
      message: "Signup request failed",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start,
    };
  }
}

/**
 * Run all API connection tests
 */
export async function runAllTests(): Promise<TestSuite> {
  console.log("🧪 Starting API Connection Tests...");
  console.log(`📡 Server URL: ${API_BASE_URL}`);
  console.log("-----------------------------------");

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  const healthResult = await testHealthCheck();
  results.push(healthResult);
  if (healthResult.success) passed++;
  else failed++;
  console.log(
    `${healthResult.success ? "✅" : "❌"} ${healthResult.name}: ${healthResult.message}`
  );

  // If health check fails, skip other tests
  if (!healthResult.success) {
    console.log("\n⚠️ Server not reachable. Skipping remaining tests.");
    console.log("Make sure the server is running on:", API_BASE_URL);
    return { passed, failed, results };
  }

  // Test 2: Invalid Login (should fail gracefully)
  const invalidLoginResult = await testInvalidLogin();
  results.push(invalidLoginResult);
  if (invalidLoginResult.success) passed++;
  else failed++;
  console.log(
    `${invalidLoginResult.success ? "✅" : "❌"} ${invalidLoginResult.name}: ${invalidLoginResult.message}`
  );

  // Test 3: Signup with test user
  const testEmail = `test_${Date.now()}@example.com`;
  const signupResult = await testSignup(
    testEmail,
    "TestPassword123!",
    "Test",
    "User",
    "+1234567890"
  );
  results.push(signupResult);
  if (signupResult.success) passed++;
  else failed++;
  console.log(
    `${signupResult.success ? "✅" : "❌"} ${signupResult.name}: ${signupResult.message}`
  );

  // Test 4: Login with the test user we just created
  if (signupResult.success && signupResult.data?.token) {
    const loginResult = await testLogin(testEmail, "TestPassword123!");
    results.push(loginResult);
    if (loginResult.success) passed++;
    else failed++;
    console.log(
      `${loginResult.success ? "✅" : "❌"} ${loginResult.name}: ${loginResult.message}`
    );
  }

  console.log("-----------------------------------");
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  return { passed, failed, results };
}

/**
 * Quick test function to verify server connection
 * Call this from a component to test the API
 */
export async function testApiConnection(): Promise<boolean> {
  const result = await testHealthCheck();
  return result.success;
}

export default {
  testHealthCheck,
  testLogin,
  testInvalidLogin,
  testSignup,
  runAllTests,
  testApiConnection,
};
