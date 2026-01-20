/**
 * Mock Authentication Service
 * 
 * @description Provides mock authentication for development and testing.
 * Validates credentials against mock user data.
 */

import { mockCurrentUser, mockUsers } from "@/data/mockData";
import type { AppUser, SubscriptionStatus } from "@/types";

// Development mode flag - set to false to use real API
export const USE_MOCK_AUTH = __DEV__;

export interface AuthResponse {
  success: boolean;
  user?: AppUser;
  token?: string;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

// Mock passwords for testing (in real app, these would be hashed)
const mockPasswords: Record<string, string> = {
  "john.doe@example.com": "password123",
  "jane.smith@example.com": "password123",
  "mike.wilson@example.com": "password123",
  "sarah.johnson@example.com": "password123",
};

/**
 * Simulates network delay for realistic testing
 */
const simulateDelay = (ms: number = 1000): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate a mock JWT token
 */
const generateMockToken = (userId: string): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    })
  );
  const signature = btoa("mock-signature");
  return `${header}.${payload}.${signature}`;
};

/**
 * Mock login function
 */
export const mockLogin = async (
  credentials: LoginCredentials
): Promise<AuthResponse> => {
  await simulateDelay(800);

  const { email, password } = credentials;

  // Find user by email
  const user = mockUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return {
      success: false,
      error: "No account found with this email address",
    };
  }

  // Check password
  const correctPassword = mockPasswords[email.toLowerCase()];
  if (!correctPassword || password !== correctPassword) {
    return {
      success: false,
      error: "Invalid password",
    };
  }

  return {
    success: true,
    user,
    token: generateMockToken(user.id),
  };
};

/**
 * Mock signup function
 */
export const mockSignup = async (
  credentials: SignupCredentials
): Promise<AuthResponse> => {
  await simulateDelay(1000);

  const { email, password, firstName, lastName, phoneNumber } = credentials;

  // Check if email already exists
  const existingUser = mockUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    return {
      success: false,
      error: "An account with this email already exists",
    };
  }

  // Validate password strength (basic)
  if (password.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters long",
    };
  }

  // Create new mock user matching AppUser interface
  const newUser: AppUser = {
    id: `user_${Date.now()}`,
    email,
    firstName: firstName || "",
    lastName: lastName || "",
    phone: phoneNumber || "",
    points: 0,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName || email)}&background=random`,
    subscriptionStatus: "INACTIVE" as unknown as SubscriptionStatus,
    surveysubscriptionStatus: "INACTIVE" as unknown as SubscriptionStatus,
    currentSubscriptionId: null,
    privacySettings: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // In a real scenario, we'd add the user to the mock data
  // For now, we'll just return the new user
  mockPasswords[email.toLowerCase()] = password;

  return {
    success: true,
    user: newUser,
    token: generateMockToken(newUser.id),
  };
};

/**
 * Mock token refresh
 */
export const mockRefreshToken = async (
  currentToken: string
): Promise<AuthResponse> => {
  await simulateDelay(500);

  // In mock mode, just return the current user with a new token
  return {
    success: true,
    user: mockCurrentUser,
    token: generateMockToken(mockCurrentUser.id),
  };
};

/**
 * Mock get current user
 */
export const mockGetCurrentUser = async (): Promise<AuthResponse> => {
  await simulateDelay(300);

  return {
    success: true,
    user: mockCurrentUser,
  };
};

/**
 * Test credentials for development
 */
export const testCredentials = {
  email: "john.doe@example.com",
  password: "password123",
};
