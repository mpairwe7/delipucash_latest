/**
 * Mock Authentication Service
 * 
 * @description Provides mock authentication for development and testing.
 * When USE_MOCK_AUTH is false, this module is not used - real API auth is used instead.
 *
 * To test with real API:
 * 1. Set USE_MOCK_AUTH to false below
 * 2. Ensure EXPO_PUBLIC_API_URL is set in .env to your server URL
 * 3. Make sure your server is running
 *
 * NOTE: This module contains inline mock data for testing purposes only.
 * No external mock data imports - self-contained for optional testing.
 */

import { SubscriptionStatus, UserRole, type AppUser } from "@/types";

// ============================================================================
// INLINE MOCK DATA (for testing only when USE_MOCK_AUTH = true)
// ============================================================================

/**
 * Mock current user for testing
 */
const mockCurrentUser: AppUser = {
  id: "user_001",
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe",
  phone: "+256700123456",
  points: 1250,
  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
  role: UserRole.USER,
  subscriptionStatus: SubscriptionStatus.ACTIVE,
  surveysubscriptionStatus: SubscriptionStatus.ACTIVE,
  currentSubscriptionId: "sub_001",
  privacySettings: null,
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2025-01-20T12:00:00Z",
};

/**
 * Mock users array for testing
 */
const mockUsers: AppUser[] = [
  mockCurrentUser,
  {
    id: "user_002",
    email: "jane.smith@example.com",
    firstName: "Jane",
    lastName: "Smith",
    phone: "+256700234567",
    points: 850,
    avatar: "https://ui-avatars.com/api/?name=Jane+Smith&background=random",
    role: UserRole.USER,
    subscriptionStatus: SubscriptionStatus.INACTIVE,
    surveysubscriptionStatus: SubscriptionStatus.INACTIVE,
    currentSubscriptionId: null,
    privacySettings: null,
    createdAt: "2024-02-10T08:00:00Z",
    updatedAt: "2025-01-18T14:00:00Z",
  },
  {
    id: "admin_001",
    email: "admin@delipucash.com",
    firstName: "Admin",
    lastName: "User",
    phone: "+256700000001",
    points: 0,
    avatar: "https://ui-avatars.com/api/?name=Admin&background=random",
    role: UserRole.ADMIN,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    surveysubscriptionStatus: SubscriptionStatus.ACTIVE,
    currentSubscriptionId: null,
    privacySettings: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

/**
 * Toggle between mock authentication and real API
 * 
 * Set to `false` to use real backend API for authentication
 * Set to `true` or `__DEV__` for mock authentication
 * 
 * For testing real API in development:
 * export const USE_MOCK_AUTH = false;
 */
export const USE_MOCK_AUTH = false; // Changed to false to test with real API

// Use AuthResponse from store for consistency
import type { AuthResponse } from "@/utils/auth/store";
export type { AuthResponse };

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
  "alice.smith@example.com": "password123",
  "admin@delipucash.com": "admin123456",
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
    data: {
      user,
      token: generateMockToken(user.id),
    },
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
    role: UserRole.USER,
    subscriptionStatus: SubscriptionStatus.INACTIVE,
    surveysubscriptionStatus: SubscriptionStatus.INACTIVE,
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
    data: {
      user: newUser,
      token: generateMockToken(newUser.id),
    },
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
    data: {
      user: mockCurrentUser,
      token: generateMockToken(mockCurrentUser.id),
    },
  };
};

/**
 * Mock get current user
 */
export const mockGetCurrentUser = async (): Promise<AuthResponse> => {
  await simulateDelay(300);

  return {
    success: true,
    data: {
      user: mockCurrentUser,
      token: '', // No new token for get current user
    },
  };
};

/**
 * Test credentials for development
 * 
 * When USE_MOCK_AUTH is true: Uses mock credentials (john.doe@example.com)
 * When USE_MOCK_AUTH is false: Uses real API test credentials
 */
export const testCredentials = USE_MOCK_AUTH
  ? {
    email: "john.doe@example.com",
    password: "password123",
  }
  : {
    // Real API test credentials - admin account from database seed
    email: "admin@delipucash.com",
    password: "admin123456",
  };
